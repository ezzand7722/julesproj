// Khedmati Chat System
// Depends on supabaseClient being initialized globally

let currentChatUser = null; // The other person in the chat
let chatSubscription = null;
let myId = null;

// Initialize Chat
async function initChat(containerId) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return;
    myId = user.id;

    // Load conversations list
    await loadConversations();

    // Subscribe to new messages
    subscribeToMessages();
}

// Subscribe to Realtime messages
function subscribeToMessages() {
    // Realtime Subscription
    chatSubscription = supabaseClient
        .channel('public:messages')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${myId}`
        }, payload => {
            console.log('New message received:', payload);
            handleNewMessage(payload.new);
        })
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=eq.${myId}`
        }, payload => {
            // Also handle my own messages if sent from another tab
            handleNewMessage(payload.new);
        })
        .subscribe((status) => {
            console.log(`📡 Realtime Connection Status: ${status}`);
            if (status === 'SUBSCRIBED') {
                console.log('✅ Listening for new messages...');
            } else if (status === 'CHANNEL_ERROR') {
                console.error('❌ Realtime Channel Error - Check Policies or Network');
            } else if (status === 'TIMED_OUT') {
                console.error('⚠️ Realtime Connection Timed Out');
            }
        });
}

// Handle incoming message
function handleNewMessage(message) {
    // If we are currently chatting with this sender, append message
    if (currentChatUser && currentChatUser.id === message.sender_id) {
        appendMessage(message, false); // false = received
        markAsRead(message.id);
        scrollToBottom();
    } else {
        // Otherwise, update the conversation list (show badge/preview)
        showNotification('رسالة جديدة!', 'info');
        loadConversations(); // Reload list to show new message at top
    }
}

// Load Conversations List
async function loadConversations() {
    const listContainer = document.getElementById('conversationsList');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="loading-spinner">جاري التحميل...</div>';

    // 0) First source of truth: existing messages (works even when bookings are legacy/misaligned)
    const contactMap = new Map();
    const { data: relatedMessages } = await supabaseClient
        .from('messages')
        .select('sender_id, receiver_id, created_at')
        .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
        .order('created_at', { ascending: false })
        .limit(500);

    const partnerIdsFromMessages = [...new Set((relatedMessages || []).map(m => {
        if (m.sender_id === myId) return m.receiver_id;
        if (m.receiver_id === myId) return m.sender_id;
        return null;
    }).filter(id => id && id !== myId))];

    if (partnerIdsFromMessages.length > 0) {
        const { data: partnerProfiles } = await supabaseClient
            .from('profiles')
            .select('id, full_name, role')
            .in('id', partnerIdsFromMessages);

        const profileMap = new Map();
        (partnerProfiles || []).forEach(p => profileMap.set(p.id, p));

        partnerIdsFromMessages.forEach(partnerId => {
            const p = profileMap.get(partnerId);
            const displayName = p?.full_name || 'مستخدم';
            contactMap.set(partnerId, {
                id: partnerId,
                name: displayName,
                specialty: p?.role === 'provider' ? 'مقدم خدمة' : 'عميل',
                avatar: displayName.substring(0, 2)
            });
        });
    }

    // 1. Get my role
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', myId)
        .single();

    let contacts = Array.from(contactMap.values());

    if (profile?.role === 'customer') {
        const { data: bookings } = await supabaseClient
            .from('bookings')
            .select('provider_id, providers(user_id, name, id, specialty)')
            .eq('customer_id', myId); // Using auth.uid mapping needed? 
        // Wait, bookings.customer_id is UUID linking to auth.users usually?
        // Let's check schema. In `bookings`, customer_id is UUID.

        // Extract unique providers
        const map = new Map();
        bookings?.forEach(b => {
            // providers info is joined. provider.user_id is the auth id (chat partner)
            if (b.providers && b.providers.user_id) {
                map.set(b.providers.user_id, {
                    id: b.providers.user_id, // Auth ID (for chat)
                    name: b.providers.name,
                    specialty: b.providers.specialty || 'مقدم خدمة',
                    avatar: b.providers.name.substring(0, 2)
                });
            }
        });
        map.forEach((value, key) => {
            if (!contactMap.has(key)) contactMap.set(key, value);
        });
        contacts = Array.from(contactMap.values());

    } else {
        // Provider: Get customers
        // We need to fetch bookings where provider_id matches any provider row for this user
        const { data: providerRows, error: providerError } = await supabaseClient
            .from('providers')
            .select('id')
            .eq('user_id', myId)
            .order('created_at', { ascending: false });

        if (providerError) {
            console.error('Failed to load provider row for chat contacts:', providerError);
        }

        const providerIds = providerRows?.map(p => p.id).filter(Boolean) || [];

        if (providerIds.length > 0) {
            const { data: bookings } = await supabaseClient
                .from('bookings')
                .select('customer_id, customer_name')
                .in('provider_id', providerIds);

            const customerIds = [...new Set((bookings || []).map(b => b.customer_id).filter(Boolean))];
            const profileNameMap = new Map();

            if (customerIds.length > 0) {
                const { data: customerProfiles } = await supabaseClient
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', customerIds);

                (customerProfiles || []).forEach(p => {
                    profileNameMap.set(p.id, p.full_name || 'عميل');
                });
            }

            const map = new Map();
            bookings?.forEach(b => {
                if (b.customer_id) {
                    const displayName = profileNameMap.get(b.customer_id) || b.customer_name || 'عميل';
                    map.set(b.customer_id, {
                        id: b.customer_id,
                        name: displayName,
                        specialty: 'عميل',
                        avatar: displayName.substring(0, 2)
                    });
                }
            });
            map.forEach((value, key) => {
                if (!contactMap.has(key)) contactMap.set(key, value);
            });
            contacts = Array.from(contactMap.values());
        }
    }

    console.log('Chat contacts loaded:', contacts.length);

    // Render Contacts
    if (contacts.length === 0) {
        listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">لا توجد محادثات سابقة</div>';
        return;
    }

    listContainer.innerHTML = contacts.map(contact => `
        <div class="conversation-item" onclick="openChat('${contact.id}', '${contact.name}', '${contact.specialty || ''}')">
            <div class="conversation-avatar">${contact.avatar}</div>
            <div class="conversation-info">
                <span class="conversation-name">${contact.name}</span>
                <span class="conversation-preview">انقر للبدء...</span>
            </div>
        </div>
    `).join('');
}

// Open Chat with a User
async function openChat(partnerId, partnerName, partnerService = 'خدمة') {
    currentChatUser = { id: partnerId, name: partnerName, service: partnerService };

    // UI Updates
    document.getElementById('chatHeaderName').textContent = partnerName;
    
    // Update service subtitle if it exists
    const serviceEl = document.getElementById('chatHeaderService');
    if (serviceEl) {
        serviceEl.textContent = partnerService;
    }
    
    document.getElementById('chatMessages').innerHTML = '<div class="loading-spinner">جاري تحميل الرسائل...</div>';

    // Mobile: Hide sidebar
    const sidebar = document.querySelector('.chat-sidebar');
    if (window.innerWidth < 768) {
        sidebar.classList.add('hidden');
        document.querySelector('.back-btn').style.display = 'block';
    }

    document.getElementById('noChatSelected').style.display = 'none';
    document.getElementById('activeChat').style.display = 'flex';

    await loadMessages(partnerId);
    scrollToBottom();
}

// Load Messages History
async function loadMessages(partnerId) {
    const { data: messages, error } = await supabaseClient
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${myId},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${myId})`)
        .order('created_at', { ascending: true });

    const container = document.getElementById('chatMessages');
    container.innerHTML = '';

    if (!messages || messages.length === 0) {
        container.innerHTML = '<div style="text-align:center; margin-top:50px; color:#aaa;">ابدأ المحادثة الآن! 👋</div>';
        return;
    }

    messages.forEach(msg => {
        const isSent = msg.sender_id === myId;
        appendMessage(msg, isSent);
    });
}

// Append a single message to UI
function appendMessage(msg, isSent) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `message ${isSent ? 'sent' : 'received'}`;

    const time = new Date(msg.created_at).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });

    div.innerHTML = `
        ${escapeHtml(msg.content)}
        <div class="message-time">${time}</div>
    `;
    container.appendChild(div);
}

// Send Message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !currentChatUser) return;

    input.value = '';

    // Optimistic UI Update
    const tempMsg = {
        content: content,
        created_at: new Date().toISOString(),
        sender_id: myId
    };
    appendMessage(tempMsg, true);
    scrollToBottom();

    // Send to DB
    const { error } = await supabaseClient
        .from('messages')
        .insert([{
            sender_id: myId,
            receiver_id: currentChatUser.id,
            content: content
        }]);

    if (error) {
        console.error('Send failed:', error);
        showNotification('فشل إرسال الرسالة', 'error');
    }
}

// Mark message as read
async function markAsRead(messageId) {
    if (!messageId) return;

    // Optimistic check? No need, just fire and forget.
    const { error } = await supabaseClient
        .from('messages')
        .update({ is_read: true })
        .eq('id', messageId)
        .eq('receiver_id', myId); // Security: only receiver can mark as read

    if (error) {
        console.error('Error marking message as read:', error);
    }
}

// Utils
function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) container.scrollTop = container.scrollHeight;
}

function backToConversations() {
    document.querySelector('.chat-sidebar').classList.remove('hidden');
    document.querySelector('.back-btn').style.display = 'none';
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Make global
window.initChat = initChat;
window.openChat = openChat;
window.sendMessage = sendMessage;

// Call functionality
function callProvider() {
    if (currentChatUser && currentChatUser.id) {
        // In a real app, this would initiate a call or show phone number
        alert(`اتصال بـ ${currentChatUser.name}\nسيتم إضافة رقم الهاتف لاحقاً`);
    }
}

function callCustomer() {
    if (currentChatUser && currentChatUser.id) {
        alert(`اتصال بـ ${currentChatUser.name}\nسيتم إضافة رقم الهاتف لاحقاً`);
    }
}

window.callProvider = callProvider;
window.callCustomer = callCustomer;
window.backToConversations = backToConversations;
