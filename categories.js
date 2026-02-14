// Shared Service Categories Configuration

const SERVICE_CATEGORIES = [
    {
        id: 'home_maintenance',
        title: 'صيانة منزلية',
        icon: '🏠',
        keywords: ['سباكة', 'كهرباء', 'نجارة', 'ألمنيوم', 'حدادة', 'بلاط', 'دهان', 'عزل', 'حشرات', 'عامة']
    },
    {
        id: 'appliances',
        title: 'أجهزة منزلية',
        icon: '❄️',
        keywords: ['تكييف', 'غسالات', 'ثلاجات', 'أفران', 'سخانات', 'طاقة شمسية']
    },
    {
        id: 'cars',
        title: 'سيارات',
        icon: '🚗',
        keywords: ['ميكانيك', 'كهرباء سيارات', 'تلميع', 'بنشر', 'سيارات']
    },
    {
        id: 'education',
        title: 'تعليم وتدريب',
        icon: '🎓',
        keywords: ['تعليم', 'دروس', 'تدريب', 'سباحة', 'قيادة']
    },
    {
        id: 'personal',
        title: 'عناية شخصية',
        icon: '💇‍♂️',
        keywords: ['حلاقة', 'تجميل', 'تمريض', 'علاج', 'رعاية']
    },
    {
        id: 'technology',
        title: 'تكنولوجيا',
        icon: '💻',
        keywords: ['كمبيوتر', 'جوالات', 'شبكات', 'ستلايت', 'كاميرات']
    },
    {
        id: 'logistics',
        title: 'نقل وتوصيل',
        icon: '🚚',
        keywords: ['نقل', 'توصيل']
    },
    {
        id: 'other',
        title: 'خدمات أخرى',
        icon: '✨',
        keywords: ['تنظيف', 'خياطة', 'أحذية', 'زراعة', 'تصوير', 'طبخ']
    }
];

// Make it available globally if using modules, but for simple script tags this works naturally
if (typeof window !== 'undefined') {
    window.SERVICE_CATEGORIES = SERVICE_CATEGORIES;
}
