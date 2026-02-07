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

    // Complex query: Get distinct list of people I've chatted with
    // Supabase doesn't support complex distinct on multiple cols easily via JS sdk alone 
    // without a view or RPC.
    // WORKAROUND: Fetch my bookings to get known contacts (Providers/Customers)
    // OR: Fetch all messages involved in.

    // For simplicity: We will fetch "Contacts" derived from Bookings.
    // If I am customer -> fetch my providers from bookings.
    // If I am provider -> fetch my customers from bookings.

    // 1. Get my role
    const { data: profile } = await supabaseClient
        .from('profiles')
        .select('role')
        .eq('id', myId)
        .single();

    let contacts = [];

    if (profile.role === 'customer') {
        const { data: bookings } = await supabaseClient
            .from('bookings')
            .select('provider_id, providers(user_id, name, id)')
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
                    avatar: b.providers.name.substring(0, 2)
                });
            }
        });
        contacts = Array.from(map.values());

    } else {
        // Provider: Get customers
        // We need to fetch bookings where provider_id matches my provider record
        // First get my provider record
        const { data: providerParams } = await supabaseClient
            .from('providers')
            .select('id')
            .eq('user_id', myId)
            .single();

        if (providerParams) {
            const { data: bookings } = await supabaseClient
                .from('bookings')
                .select('customer_id, customer_name')
                .eq('provider_id', providerParams.id);

            const map = new Map();
            bookings?.forEach(b => {
                if (b.customer_id) {
                    map.set(b.customer_id, {
                        id: b.customer_id,
                        name: b.customer_name,
                        avatar: b.customer_name.substring(0, 2)
                    });
                }
            });
            contacts = Array.from(map.values());
        }
    }

    // Render Contacts
    if (contacts.length === 0) {
        listContainer.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">لا توجد محادثات سابقة</div>';
        return;
    }

    listContainer.innerHTML = contacts.map(contact => `
        <div class="conversation-item" onclick="openChat('${contact.id}', '${contact.name}')">
            <div class="conversation-avatar">${contact.avatar}</div>
            <div class="conversation-info">
                <span class="conversation-name">${contact.name}</span>
                <span class="conversation-preview">انقر للبدء...</span>
            </div>
        </div>
    `).join('');
}

// Open Chat with a User
async function openChat(partnerId, partnerName) {
    currentChatUser = { id: partnerId, name: partnerName };

    // UI Updates
    document.getElementById('chatHeaderName').textContent = partnerName;
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
window.backToConversations = backToConversations;
