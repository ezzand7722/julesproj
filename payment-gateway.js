/**
 * Payment Gateway Integration
 * Supports: Credit Cards, CliQ, uWallet, Orange Money
 * 
 * This file provides integration with various payment methods popular in Jordan
 */

// Payment Gateway Configuration
const PAYMENT_CONFIG = {
    // PayTabs (ClickPay) - Popular in Jordan for credit cards
    paytabs: {
        enabled: true,
        profileId: 'YOUR_PAYTABS_PROFILE_ID', // Replace with actual credentials
        serverKey: 'YOUR_PAYTABS_SERVER_KEY',
        clientKey: 'YOUR_PAYTABS_CLIENT_KEY',
        endpoint: 'https://secure.paytabs.com/payment/request'
    },
    
    // CliQ - Jordan's instant payment system
    cliq: {
        enabled: true,
        aliasFormat: /^[0-9]{10}$/, // Jordan mobile number format
        banks: ['ABC Bank', 'Arab Bank', 'Bank Al Etihad', 'Cairo Amman Bank', 'Housing Bank', 'Jordan Ahli Bank']
    },
    
    // Orange Money - Mobile wallet
    orangeMoney: {
        enabled: true,
        apiKey: 'YOUR_ORANGE_MONEY_API_KEY',
        merchantCode: 'YOUR_MERCHANT_CODE',
        endpoint: 'https://api.orange.jo/omcoreapis/1.0.0/mp/pay'
    },
    
    // uWallet - Digital wallet
    uwallet: {
        enabled: true,
        merchantId: 'YOUR_UWALLET_MERCHANT_ID',
        apiKey: 'YOUR_UWALLET_API_KEY',
        endpoint: 'https://api.uwallet.jo/v1/payments'
    }
};

/**
 * Initialize Credit Card Payment via PayTabs
 */
async function initCreditCardPayment(amount, packageName, userEmail, creditsAmount, supabaseClient) {
    if (!PAYMENT_CONFIG.paytabs.enabled) {
        throw new Error('Credit card payments are not configured');
    }

    try {
        // First, create payment record in database to get proper UUID
        const { data, error } = await supabaseClient.rpc('create_topup_payment', {
            p_amount: amount,
            p_provider: 'credit_card',
            p_package_name: packageName,
            p_wallet_details: null
        });

        if (error) throw error;

        // In production, this should call your backend which then calls PayTabs
        // For now, we'll simulate the payment page URL
        console.log('PayTabs Payment initiated:', data);
        
        // Return payment URL (in production, this comes from PayTabs API)
        return {
            success: true,
            paymentUrl: '#', // This would be the actual PayTabs payment page URL
            paymentId: data.payment_id,
            creditsAmount: creditsAmount,
            packageName: packageName,
            method: 'credit_card'
        };
        
    } catch (error) {
        console.error('PayTabs Error:', error);
        throw error;
    }
}

/**
 * Initialize CliQ Payment
 */
async function initCliqPayment(amount, packageName, cliqAlias, supabaseClient) {
    if (!PAYMENT_CONFIG.cliq.enabled) {
        throw new Error('CliQ payments are not configured');
    }

    // Validate CliQ alias (mobile number)
    if (!PAYMENT_CONFIG.cliq.aliasFormat.test(cliqAlias)) {
        throw new Error('رقم الموبايل غير صحيح. يرجى إدخال رقم أردني صحيح');
    }

    try {
        // Create payment record
        const { data, error } = await supabaseClient.rpc('create_topup_payment', {
            p_amount: amount,
            p_provider: 'cliq',
            p_package_name: packageName,
            p_wallet_details: {
                phone: cliqAlias,
                type: 'cliq'
            }
        });

        if (error) throw error;

        // In production, this would:
        // 1. Send CliQ payment request to the bank
        // 2. Wait for user to approve on their banking app
        // 3. Receive callback from bank
        // 4. Confirm payment
        
        return {
            success: true,
            paymentId: data.payment_id,
            method: 'cliq',
            message: 'تم إرسال طلب الدفع. يرجى الموافقة من تطبيق البنك الخاص بك',
            instructions: `سيصلك إشعار على تطبيق البنك لتأكيد دفع ${amount} دينار أردني`
        };

    } catch (error) {
        console.error('CliQ Error:', error);
        throw error;
    }
}

/**
 * Initialize Orange Money Payment
 */
async function initOrangeMoneyPayment(amount, packageName, phoneNumber, supabaseClient) {
    if (!PAYMENT_CONFIG.orangeMoney.enabled) {
        throw new Error('Orange Money is not configured');
    }

    // Validate phone number
    if (!/^(078|079)[0-9]{7}$/.test(phoneNumber)) {
        throw new Error('رقم Orange غير صحيح');
    }

    try {
        // Create payment record
        const { data, error } = await supabaseClient.rpc('create_topup_payment', {
            p_amount: amount,
            p_provider: 'orange_money',
            p_package_name: packageName,
            p_wallet_details: {
                phone: phoneNumber,
                type: 'orange_money'
            }
        });

        if (error) throw error;

        // In production, integrate with Orange Money API
        return {
            success: true,
            paymentId: data.payment_id,
            method: 'orange_money',
            message: 'سيصلك رمز التأكيد عبر رسالة SMS',
            instructions: `أدخل الرمز المرسل إلى ${phoneNumber} لإتمام الدفع`
        };

    } catch (error) {
        console.error('Orange Money Error:', error);
        throw error;
    }
}

/**
 * Initialize uWallet Payment
 */
async function initUWalletPayment(amount, packageName, walletAccount, supabaseClient) {
    if (!PAYMENT_CONFIG.uwallet.enabled) {
        throw new Error('uWallet is not configured');
    }

    try {
        // Create payment record
        const { data, error } = await supabaseClient.rpc('create_topup_payment', {
            p_amount: amount,
            p_provider: 'uwallet',
            p_package_name: packageName,
            p_wallet_details: {
                account: walletAccount,
                type: 'uwallet'
            }
        });

        if (error) throw error;

        // In production, integrate with uWallet API
        return {
            success: true,
            paymentId: data.payment_id,
            method: 'uwallet',
            message: 'جاري معالجة الدفع عبر uWallet',
            qrCode: `uwallet://pay?amount=${amount}&merchant=${PAYMENT_CONFIG.uwallet.merchantId}&ref=${data.payment_id}`
        };

    } catch (error) {
        console.error('uWallet Error:', error);
        throw error;
    }
}

/**
 * Confirm Payment (called when payment is verified)
 */
async function confirmPayment(paymentId, transactionRef, creditsAmount, packageName, supabaseClient) {
    try {
        const { data, error } = await supabaseClient.rpc('confirm_topup_payment', {
            p_payment_id: paymentId,
            p_transaction_ref: transactionRef,
            p_credits_amount: creditsAmount,
            p_package_name: packageName
        });

        if (error) throw error;

        return data;
    } catch (error) {
        console.error('Payment confirmation error:', error);
        throw error;
    }
}

/**
 * Simulate Payment Success (for testing/demo - CREDIT CARD ONLY)
 * Remove this in production
 */
async function simulatePaymentSuccess(paymentId, creditsAmount, packageName, supabaseClient) {
    // Wait 2 seconds to simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate fake transaction reference
    const transactionRef = `SIM_${Date.now()}`;
    
    // Confirm payment (auto-approve for demo)
    return await confirmPayment(paymentId, transactionRef, creditsAmount, packageName, supabaseClient);
}

/**
 * Get pending payments for manual verification
 */
async function getPendingPayments(supabaseClient) {
    const { data, error } = await supabaseClient
        .from('payments')
        .select(`
            id,
            amount,
            provider,
            created_at,
            wallet_transactions (
                wallet_type,
                wallet_phone,
                wallet_account
            )
        `)
        .eq('status', 'pending')
        .eq('payment_purpose', 'topup')
        .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
}

// Export functions
window.PaymentGateway = {
    config: PAYMENT_CONFIG,
    initCreditCardPayment,
    initCliqPayment,
    initOrangeMoneyPayment,
    initUWalletPayment,
    confirmPayment,
    simulatePaymentSuccess,
    getPendingPayments
};
