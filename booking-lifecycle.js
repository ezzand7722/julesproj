/**
 * Booking Lifecycle Manager
 * =========================
 * Handles automatic cleanup of stale bookings:
 * 
 * 1. GHOSTED BOOKINGS (pending > 48h):
 *    - Warns customer after 48 hours
 *    - Auto-cancels after 7 days if provider never responds
 *
 * 2. OVERDUE CONFIRMED (service_date + 3 days):
 *    - Reminds provider to mark complete
 *    - Auto-completes after 7 more days
 *
 * 3. OLD COMPLETED (completed > 30 days):
 *    - Archives (soft-delete) silently
 * 
 * Runs on dashboard load for the logged-in user.
 */

const BookingLifecycle = {
    supabase: null,
    userId: null,
    userRole: null,  // 'customer' or 'provider'
    providerId: null,

    // Timing thresholds (in hours)
    GHOST_WARN_HOURS: 48,       // Warn customer after 48h pending
    GHOST_CANCEL_DAYS: 7,       // Auto-cancel after 7 days pending
    OVERDUE_REMIND_DAYS: 3,     // Remind provider 3 days after service_date
    OVERDUE_COMPLETE_DAYS: 10,  // Auto-complete 10 days after service_date
    ARCHIVE_DAYS: 30,           // Archive completed bookings after 30 days

    /**
     * Initialize and run lifecycle checks
     */
    async init(supabaseClient, userId, role, providerId) {
        this.supabase = supabaseClient;
        this.userId = userId;
        this.userRole = role;
        this.providerId = providerId;

        try {
            await this.runLifecycleChecks();
        } catch (err) {
            console.error('[BookingLifecycle] Error:', err);
        }
    },

    /**
     * Main lifecycle check runner
     */
    async runLifecycleChecks() {
        const now = new Date();

        if (this.userRole === 'customer') {
            await this.checkGhostedBookings(now);
        }
        if (this.userRole === 'provider') {
            await this.checkOverdueConfirmed(now);
        }

        // Both roles: archive old completed
        await this.archiveOldCompleted(now);
        // Both roles: auto-cancel long-ghosted
        await this.autoActionGhosted(now);
        // Both roles: auto-complete long-overdue
        await this.autoActionOverdue(now);
    },

    // ========================
    // 1. GHOSTED BOOKINGS
    // ========================

    /**
     * Find pending bookings older than 48h and warn the customer
     */
    async checkGhostedBookings(now) {
        const cutoff = new Date(now.getTime() - this.GHOST_WARN_HOURS * 60 * 60 * 1000);

        const { data: ghosted, error } = await this.supabase
            .from('bookings')
            .select('*, providers(name)')
            .eq('customer_id', this.userId)
            .eq('status', 'pending')
            .eq('lifecycle_notified', false)
            .lt('created_at', cutoff.toISOString())
            .eq('archived', false);

        if (error || !ghosted || ghosted.length === 0) return;

        for (const booking of ghosted) {
            const providerName = booking.providers?.name || 'مقدم الخدمة';
            const hoursAgo = Math.round((now - new Date(booking.created_at)) / (1000 * 60 * 60));

            // Create notification
            await this.supabase.from('booking_notifications').insert({
                booking_id: booking.id,
                user_id: this.userId,
                user_role: 'customer',
                notification_type: 'ghosted_warning',
                message: `⏳ حجزك مع ${providerName} لم يتم الرد عليه منذ ${hoursAgo} ساعة. يمكنك إلغاؤه أو الانتظار.`
            });

            // Mark as notified
            await this.supabase
                .from('bookings')
                .update({ lifecycle_notified: true })
                .eq('id', booking.id);
        }
    },

    /**
     * Auto-cancel bookings pending for more than 7 days
     */
    async autoActionGhosted(now) {
        const cutoff = new Date(now.getTime() - this.GHOST_CANCEL_DAYS * 24 * 60 * 60 * 1000);

        // Build query based on role
        let query = this.supabase
            .from('bookings')
            .select('*, providers(name)')
            .eq('status', 'pending')
            .lt('created_at', cutoff.toISOString())
            .eq('archived', false);

        if (this.userRole === 'customer') {
            query = query.eq('customer_id', this.userId);
        } else if (this.userRole === 'provider') {
            query = query.eq('provider_id', this.providerId);
        }

        const { data: expired, error } = await query;
        if (error || !expired || expired.length === 0) return;

        for (const booking of expired) {
            // Auto-cancel
            await this.supabase
                .from('bookings')
                .update({ status: 'auto_cancelled' })
                .eq('id', booking.id);

            // Notify customer
            if (booking.customer_id) {
                const providerName = booking.providers?.name || 'مقدم الخدمة';
                await this.supabase.from('booking_notifications').upsert({
                    booking_id: booking.id,
                    user_id: booking.customer_id,
                    user_role: 'customer',
                    notification_type: 'ghosted_auto_cancel',
                    message: `❌ تم إلغاء حجزك مع ${providerName} تلقائياً لعدم الرد خلال ${this.GHOST_CANCEL_DAYS} أيام.`
                }, { onConflict: 'booking_id,user_id,notification_type', ignoreDuplicates: true }).catch(() => {
                    // Fallback: insert without upsert
                    this.supabase.from('booking_notifications').insert({
                        booking_id: booking.id,
                        user_id: booking.customer_id,
                        user_role: 'customer',
                        notification_type: 'ghosted_auto_cancel',
                        message: `❌ تم إلغاء حجزك مع ${providerName} تلقائياً لعدم الرد خلال ${this.GHOST_CANCEL_DAYS} أيام.`
                    });
                });
            }
        }
    },

    // ========================
    // 2. OVERDUE CONFIRMED
    // ========================

    /**
     * Remind provider about confirmed bookings past their date
     */
    async checkOverdueConfirmed(now) {
        const cutoffDate = new Date(now.getTime() - this.OVERDUE_REMIND_DAYS * 24 * 60 * 60 * 1000);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        const { data: overdue, error } = await this.supabase
            .from('bookings')
            .select('*')
            .eq('provider_id', this.providerId)
            .eq('status', 'confirmed')
            .eq('lifecycle_notified', false)
            .lt('service_date', cutoffStr)
            .eq('archived', false);

        if (error || !overdue || overdue.length === 0) return;

        for (const booking of overdue) {
            const daysPast = Math.round((now - new Date(booking.service_date)) / (1000 * 60 * 60 * 24));

            await this.supabase.from('booking_notifications').insert({
                booking_id: booking.id,
                user_id: this.userId,
                user_role: 'provider',
                notification_type: 'overdue_reminder',
                message: `⚠️ حجز ${booking.customer_name} (${booking.service_date}) مضى عليه ${daysPast} أيام. هل تمت الخدمة؟ قم بإنهائه أو سيتم إنهاؤه تلقائياً.`
            });

            await this.supabase
                .from('bookings')
                .update({ lifecycle_notified: true })
                .eq('id', booking.id);
        }
    },

    /**
     * Auto-complete confirmed bookings that are way overdue
     */
    async autoActionOverdue(now) {
        const cutoffDate = new Date(now.getTime() - this.OVERDUE_COMPLETE_DAYS * 24 * 60 * 60 * 1000);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        let query = this.supabase
            .from('bookings')
            .select('*, providers(name)')
            .eq('status', 'confirmed')
            .lt('service_date', cutoffStr)
            .eq('archived', false);

        if (this.userRole === 'provider') {
            query = query.eq('provider_id', this.providerId);
        } else {
            query = query.eq('customer_id', this.userId);
        }

        const { data: overdue, error } = await query;
        if (error || !overdue || overdue.length === 0) return;

        for (const booking of overdue) {
            await this.supabase
                .from('bookings')
                .update({ status: 'auto_completed' })
                .eq('id', booking.id);

            // Notify provider
            if (this.userRole === 'provider') {
                await this.supabase.from('booking_notifications').insert({
                    booking_id: booking.id,
                    user_id: this.userId,
                    user_role: 'provider',
                    notification_type: 'overdue_auto_complete',
                    message: `✅ تم إنهاء حجز ${booking.customer_name} (${booking.service_date}) تلقائياً لتجاوز الموعد بـ ${this.OVERDUE_COMPLETE_DAYS} أيام.`
                });
            }

            // Notify customer too
            if (booking.customer_id) {
                const providerName = booking.providers?.name || 'مقدم الخدمة';
                await this.supabase.from('booking_notifications').insert({
                    booking_id: booking.id,
                    user_id: booking.customer_id,
                    user_role: 'customer',
                    notification_type: 'overdue_auto_complete',
                    message: `✅ تم إنهاء حجزك مع ${providerName} (${booking.service_date}) تلقائياً.`
                });
            }
        }
    },

    // ========================
    // 3. ARCHIVE OLD COMPLETED
    // ========================

    async archiveOldCompleted(now) {
        const cutoffDate = new Date(now.getTime() - this.ARCHIVE_DAYS * 24 * 60 * 60 * 1000);
        const cutoffStr = cutoffDate.toISOString();

        let query = this.supabase
            .from('bookings')
            .select('id')
            .in('status', ['completed', 'auto_completed'])
            .eq('archived', false)
            .lt('service_date', cutoffStr.split('T')[0]);

        if (this.userRole === 'provider') {
            query = query.eq('provider_id', this.providerId);
        } else {
            query = query.eq('customer_id', this.userId);
        }

        const { data: old, error } = await query;
        if (error || !old || old.length === 0) return;

        const ids = old.map(b => b.id);

        await this.supabase
            .from('bookings')
            .update({ archived: true, archived_at: new Date().toISOString() })
            .in('id', ids);
    },

    // ========================
    // NOTIFICATION HELPERS
    // ========================

    /**
     * Get unread notifications for the current user
     */
    async getNotifications() {
        const { data, error } = await this.supabase
            .from('booking_notifications')
            .select('*')
            .eq('user_id', this.userId)
            .eq('is_read', false)
            .order('created_at', { ascending: false });

        return (error || !data) ? [] : data;
    },

    /**
     * Mark a notification as read
     */
    async markRead(notificationId) {
        await this.supabase
            .from('booking_notifications')
            .update({ is_read: true })
            .eq('id', notificationId);
    },

    /**
     * Mark all notifications as read
     */
    async markAllRead() {
        await this.supabase
            .from('booking_notifications')
            .update({ is_read: true })
            .eq('user_id', this.userId)
            .eq('is_read', false);
    },

    /**
     * Cancel a ghosted booking (customer action)
     */
    async cancelGhostedBooking(bookingId) {
        const { error } = await this.supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('id', bookingId)
            .eq('customer_id', this.userId)
            .eq('status', 'pending');

        if (!error) {
            // Mark related notification as read
            await this.supabase
                .from('booking_notifications')
                .update({ is_read: true })
                .eq('booking_id', bookingId)
                .eq('user_id', this.userId);
        }

        return !error;
    },

    /**
     * Render notification banner HTML
     */
    renderNotificationBanner(notifications) {
        if (!notifications || notifications.length === 0) return '';

        const typeIcons = {
            'ghosted_warning': '⏳',
            'ghosted_auto_cancel': '❌',
            'overdue_reminder': '⚠️',
            'overdue_auto_complete': '✅',
            'completed_archived': '🗂️'
        };

        return `
            <div class="lifecycle-notifications" id="lifecycleNotifications">
                <div class="lifecycle-header">
                    <span>🔔 إشعارات الحجوزات (${notifications.length})</span>
                    <button onclick="BookingLifecycle.dismissAll()" class="lifecycle-dismiss-all">تجاهل الكل</button>
                </div>
                ${notifications.map(n => `
                    <div class="lifecycle-notification ${n.notification_type}" data-id="${n.id}" data-booking="${n.booking_id}">
                        <div class="lifecycle-notif-content">
                            <span class="lifecycle-notif-icon">${typeIcons[n.notification_type] || '🔔'}</span>
                            <span class="lifecycle-notif-msg">${n.message}</span>
                        </div>
                        <div class="lifecycle-notif-actions">
                            ${n.notification_type === 'ghosted_warning' ? `
                                <button onclick="BookingLifecycle.handleCancelGhosted('${n.booking_id}', '${n.id}')" class="lifecycle-btn lifecycle-btn-cancel">إلغاء الحجز</button>
                                <button onclick="BookingLifecycle.handleDismiss('${n.id}')" class="lifecycle-btn lifecycle-btn-wait">انتظار</button>
                            ` : ''}
                            ${n.notification_type === 'overdue_reminder' ? `
                                <button onclick="BookingLifecycle.handleCompleteOverdue('${n.booking_id}', '${n.id}')" class="lifecycle-btn lifecycle-btn-complete">إنهاء الحجز</button>
                                <button onclick="BookingLifecycle.handleDismiss('${n.id}')" class="lifecycle-btn lifecycle-btn-wait">لاحقاً</button>
                            ` : ''}
                            ${(n.notification_type === 'ghosted_auto_cancel' || n.notification_type === 'overdue_auto_complete') ? `
                                <button onclick="BookingLifecycle.handleDismiss('${n.id}')" class="lifecycle-btn lifecycle-btn-ok">حسناً</button>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Action handlers (called from notification buttons)
     */
    async handleCancelGhosted(bookingId, notifId) {
        if (!confirm('هل تريد إلغاء هذا الحجز؟')) return;
        const success = await this.cancelGhostedBooking(bookingId);
        if (success) {
            document.querySelector(`[data-id="${notifId}"]`)?.remove();
            this.updateNotifCount();
            // Refresh bookings if function exists
            if (typeof loadBookings === 'function') loadBookings();
        }
    },

    async handleCompleteOverdue(bookingId, notifId) {
        if (!confirm('هل تمت الخدمة؟ سيتم إنهاء الحجز.')) return;
        const { error } = await this.supabase
            .from('bookings')
            .update({ status: 'completed' })
            .eq('id', bookingId);

        if (!error) {
            await this.markRead(notifId);
            document.querySelector(`[data-id="${notifId}"]`)?.remove();
            this.updateNotifCount();
            if (typeof loadBookings === 'function') loadBookings();
        }
    },

    async handleDismiss(notifId) {
        await this.markRead(notifId);
        document.querySelector(`[data-id="${notifId}"]`)?.remove();
        this.updateNotifCount();
    },

    async dismissAll() {
        await this.markAllRead();
        const container = document.getElementById('lifecycleNotifications');
        if (container) container.remove();
    },

    updateNotifCount() {
        const container = document.getElementById('lifecycleNotifications');
        if (!container) return;
        const remaining = container.querySelectorAll('.lifecycle-notification');
        if (remaining.length === 0) {
            container.remove();
        } else {
            const header = container.querySelector('.lifecycle-header span');
            if (header) header.textContent = `🔔 إشعارات الحجوزات (${remaining.length})`;
        }
    },

    /**
     * Inject CSS for notifications (called once)
     */
    injectStyles() {
        if (document.getElementById('lifecycle-styles')) return;
        const style = document.createElement('style');
        style.id = 'lifecycle-styles';
        style.textContent = `
            .lifecycle-notifications {
                margin-bottom: 20px;
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid #fde68a;
                background: #fffbeb;
            }
            .lifecycle-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #fef3c7;
                font-weight: 700;
                font-size: 0.9rem;
                color: #92400e;
            }
            .lifecycle-dismiss-all {
                background: none;
                border: none;
                color: #b45309;
                cursor: pointer;
                font-size: 0.8rem;
                font-weight: 600;
                font-family: inherit;
                text-decoration: underline;
            }
            .lifecycle-notification {
                padding: 12px 16px;
                border-bottom: 1px solid #fde68a;
                transition: background 0.2s;
            }
            .lifecycle-notification:last-child { border-bottom: none; }
            .lifecycle-notification:hover { background: #fef9e7; }
            .lifecycle-notif-content {
                display: flex;
                gap: 10px;
                align-items: flex-start;
                margin-bottom: 8px;
            }
            .lifecycle-notif-icon { font-size: 1.3rem; flex-shrink: 0; }
            .lifecycle-notif-msg {
                font-size: 0.85rem;
                color: #78350f;
                line-height: 1.5;
            }
            .lifecycle-notif-actions {
                display: flex;
                gap: 8px;
                justify-content: flex-end;
            }
            .lifecycle-btn {
                padding: 6px 14px;
                border-radius: 8px;
                font-size: 0.8rem;
                font-weight: 600;
                cursor: pointer;
                border: none;
                font-family: inherit;
                transition: all 0.2s;
            }
            .lifecycle-btn-cancel {
                background: #fee2e2;
                color: #dc2626;
            }
            .lifecycle-btn-cancel:hover { background: #fecaca; }
            .lifecycle-btn-complete {
                background: #d1fae5;
                color: #059669;
            }
            .lifecycle-btn-complete:hover { background: #a7f3d0; }
            .lifecycle-btn-wait {
                background: #f3f4f6;
                color: #6b7280;
            }
            .lifecycle-btn-wait:hover { background: #e5e7eb; }
            .lifecycle-btn-ok {
                background: #dbeafe;
                color: #2563eb;
            }
            .lifecycle-btn-ok:hover { background: #bfdbfe; }

            /* === Notification type accents === */
            .lifecycle-notification.ghosted_auto_cancel {
                background: #fef2f2;
                border-color: #fecaca;
            }
            .lifecycle-notification.ghosted_auto_cancel .lifecycle-notif-msg { color: #991b1b; }

            .lifecycle-notification.overdue_auto_complete {
                background: #f0fdf4;
                border-color: #bbf7d0;
            }
            .lifecycle-notification.overdue_auto_complete .lifecycle-notif-msg { color: #166534; }

            /* === Dark Mode === */
            [data-theme="dark"] .lifecycle-notifications {
                background: #1e293b;
                border-color: #475569;
            }
            [data-theme="dark"] .lifecycle-header {
                background: #334155;
                color: #fbbf24;
            }
            [data-theme="dark"] .lifecycle-dismiss-all { color: #fbbf24; }
            [data-theme="dark"] .lifecycle-notification {
                border-color: #475569;
            }
            [data-theme="dark"] .lifecycle-notification:hover { background: #334155; }
            [data-theme="dark"] .lifecycle-notif-msg { color: #e2e8f0; }
            [data-theme="dark"] .lifecycle-notification.ghosted_auto_cancel {
                background: rgba(220, 38, 38, 0.1);
                border-color: rgba(220, 38, 38, 0.2);
            }
            [data-theme="dark"] .lifecycle-notification.ghosted_auto_cancel .lifecycle-notif-msg { color: #fca5a5; }
            [data-theme="dark"] .lifecycle-notification.overdue_auto_complete {
                background: rgba(5, 150, 105, 0.1);
                border-color: rgba(5, 150, 105, 0.2);
            }
            [data-theme="dark"] .lifecycle-notification.overdue_auto_complete .lifecycle-notif-msg { color: #6ee7b7; }
            [data-theme="dark"] .lifecycle-btn-cancel { background: rgba(220, 38, 38, 0.2); color: #fca5a5; }
            [data-theme="dark"] .lifecycle-btn-complete { background: rgba(5, 150, 105, 0.2); color: #6ee7b7; }
            [data-theme="dark"] .lifecycle-btn-wait { background: #334155; color: #94a3b8; }
            [data-theme="dark"] .lifecycle-btn-ok { background: rgba(37, 99, 235, 0.2); color: #93c5fd; }
        `;
        document.head.appendChild(style);
    }
};
