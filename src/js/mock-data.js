import { toDateKey, addDays } from './utils.js';

export function getDefaultTheme() {
  return {
    wallpaper: 'dawn-silk',
    customWallpaper: '',
    blur: 22,
    opacity: 0.72,
    accent: '#18181b',
    mode: 'light'
  };
}

export function getDefaultSettings() {
  return {
    supabase: {
      url: '',
      anonKey: ''
    },
    appLock: {
      enabled: false,
      pin: '',
      lockFinance: true,
      lockNotes: true
    }
  };
}

  export function createMockState() {
    const now = new Date();
    const d0 = toDateKey(now);
    const d1 = toDateKey(addDays(now, 1));
    const d2 = toDateKey(addDays(now, 2));
    const d3 = toDateKey(addDays(now, 3));
    const d4 = toDateKey(addDays(now, 4));
    const d5 = toDateKey(addDays(now, 5));
    const dm1 = toDateKey(addDays(now, -1));
    const dm2 = toDateKey(addDays(now, -2));
    const dm3 = toDateKey(addDays(now, -3));
    const dm4 = toDateKey(addDays(now, -4));
    const dm5 = toDateKey(addDays(now, -5));

    const tasks = [
      {
        id: 'mock_task_1',
        type: 'booking',
        title: 'Booking lịch hẹn chụp Lookbook',
        client: 'Chị Minh Thư • Studio Quận 1',
        date: d0,
        time: '14:00',
        status: 'active',
        isDeadline: false,
        price: 4500000,
        deposit: 1500000,
        paymentStatus: 'deposited', // unpaid | deposited | paid
        remindBefore: 30,
        notes: 'Khách yêu cầu tone màu ánh sáng tự nhiên, mang theo 2 bộ lens fix.',
        isMock: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock_task_2',
        type: 'task',
        title: 'Gửi báo giá gói Branding Q4',
        client: 'Lumina Coffee',
        date: d0,
        time: '17:30',
        status: 'pending',
        isDeadline: true,
        price: 0,
        deposit: 0,
        paymentStatus: 'unpaid',
        remindBefore: 60,
        notes: 'Đính kèm 2 phương án ngân sách + timeline triển khai 4 tuần.',
        isMock: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock_task_3',
        type: 'personal',
        title: 'Lịch tập thể dục & Pilates',
        client: 'California Fitness',
        date: d0,
        time: '18:30',
        status: 'pending',
        isDeadline: false,
        price: 0,
        deposit: 0,
        paymentStatus: 'unpaid',
        remindBefore: 15,
        notes: 'Buổi tập core + giãn cơ vai gáy.',
        isMock: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock_task_4',
        type: 'task',
        title: 'Họp brief khách hàng mới',
        client: 'Mộc Skincare • Google Meet',
        date: d0,
        time: '10:30',
        status: 'done',
        isDeadline: false,
        price: 0,
        deposit: 0,
        paymentStatus: 'unpaid',
        remindBefore: 15,
        notes: 'Đã chốt moodboard & lịch giao bản demo đầu tiên.',
        isMock: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock_task_5',
        type: 'booking',
        title: 'Booking tư vấn Concept sự kiện',
        client: 'Anh Gia Huy • Thảo Điền',
        date: d1,
        time: '10:00',
        status: 'active',
        isDeadline: false,
        price: 6800000,
        deposit: 2000000,
        paymentStatus: 'deposited',
        remindBefore: 60,
        notes: 'Chuẩn bị slide tham khảo và bảng checklist thiết bị.',
        isMock: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock_task_6',
        type: 'task',
        title: 'Bàn giao file thiết kế Social Media',
        client: 'Koi Tea Vietnam',
        date: d2,
        time: '16:00',
        status: 'active',
        isDeadline: true,
        price: 0,
        deposit: 0,
        paymentStatus: 'unpaid',
        remindBefore: 60,
        notes: 'Xuất đủ size Story 9:16 và Post 4:5.',
        isMock: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock_task_7',
        type: 'booking',
        title: 'Booking Workshop cá nhân 1-1',
        client: 'Bạn Ngọc Anh • The Workshop Cafe',
        date: d3,
        time: '15:00',
        status: 'pending',
        isDeadline: false,
        price: 2200000,
        deposit: 0,
        paymentStatus: 'unpaid',
        remindBefore: 30,
        notes: 'Nhắc khách chuyển cọc 50% trước buổi hẹn 24 giờ.',
        isMock: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock_task_8',
        type: 'personal',
        title: 'Gặp gỡ đối tác & ăn tối',
        client: 'Nhà hàng Sol Kitchen',
        date: d4,
        time: '19:00',
        status: 'pending',
        isDeadline: false,
        price: 0,
        deposit: 0,
        paymentStatus: 'unpaid',
        remindBefore: 60,
        notes: 'Trao đổi kế hoạch hợp tác dự án cuối năm.',
        isMock: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock_task_9',
        type: 'booking',
        title: 'Booking quay Video Reels sản phẩm',
        client: 'Sora Jewelry • Quận 3',
        date: dm2,
        time: '09:30',
        status: 'done',
        isDeadline: false,
        price: 5500000,
        deposit: 5500000,
        paymentStatus: 'paid',
        remindBefore: 30,
        notes: 'Đã bàn giao 3 video edit hoàn chỉnh, khách đã tất toán 100%.',
        isMock: true,
        createdAt: new Date().toISOString()
      },
      {
        id: 'mock_task_10',
        type: 'task',
        title: 'Cập nhật Portfolio & bảng giá mới',
        client: 'Nội bộ ShuShu',
        date: d5,
        time: '11:00',
        status: 'pending',
        isDeadline: true,
        price: 0,
        deposit: 0,
        paymentStatus: 'unpaid',
        remindBefore: 1440,
        notes: 'Thêm 3 case study Booking gần nhất.',
        isMock: true,
        createdAt: new Date().toISOString()
      }
    ];

    const habits = [
      {
        id: 'mock_habit_1',
        name: 'Uống đủ 2L nước lọc',
        icon: '💧',
        completedDates: [dm5, dm4, dm3, dm2, dm1, d0],
        isMock: true
      },
      {
        id: 'mock_habit_2',
        name: 'Đọc sách 20 phút mỗi tối',
        icon: '📖',
        completedDates: [dm4, dm3, dm2, dm1],
        isMock: true
      },
      {
        id: 'mock_habit_3',
        name: 'Vận động / Tập thể dục 30 phút',
        icon: '🏃‍♀️',
        completedDates: [dm3, dm1, d0],
        isMock: true
      },
      {
        id: 'mock_habit_4',
        name: 'Skincare & ngủ trước 23:30',
        icon: '✨',
        completedDates: [dm5, dm4, dm3, dm2, dm1],
        isMock: true
      }
    ];

    const reminders = [
      {
        id: 'mock_rem_1',
        title: 'Kiểm tra xác nhận cọc Booking ngày mai',
        notes: 'Nhắn tin nhắc anh Gia Huy giờ hẹn 10:00 tại Thảo Điền',
        date: d0,
        time: '20:00',
        priority: 'high',
        repeat: 'none',
        completed: false,
        isMock: true
      },
      {
        id: 'mock_rem_2',
        title: 'Tổng kết thu chi & backup dữ liệu tuần',
        notes: 'Xuất file JSON sao lưu dữ liệu ShuShu',
        date: d3,
        time: '21:00',
        priority: 'medium',
        repeat: 'weekly',
        completed: false,
        isMock: true
      },
      {
        id: 'mock_rem_3',
        title: 'Uống vitamin & nghỉ mắt 5 phút',
        notes: 'Nhắc hằng ngày buổi chiều',
        date: d0,
        time: '15:30',
        priority: 'low',
        repeat: 'daily',
        completed: false,
        isMock: true
      }
    ];

    const transactions = [
      {
        id: 'mock_tx_1',
        type: 'income',
        title: 'Tất toán Booking Sora Jewelry',
        category: 'Booking',
        amount: 5500000,
        date: dm2,
        bookingId: 'mock_task_9',
        notes: 'Chuyển khoản Vietcombank',
        isMock: true
      },
      {
        id: 'mock_tx_2',
        type: 'income',
        title: 'Tiền cọc Lookbook Chị Minh Thư',
        category: 'Booking',
        amount: 1500000,
        date: dm1,
        bookingId: 'mock_task_1',
        notes: 'Cọc đợt 1 giữ lịch Studio',
        isMock: true
      },
      {
        id: 'mock_tx_3',
        type: 'income',
        title: 'Cọc Concept sự kiện Anh Gia Huy',
        category: 'Booking',
        amount: 2000000,
        date: d0,
        bookingId: 'mock_task_5',
        notes: 'Đã nhận cọc qua chuyển khoản',
        isMock: true
      },
      {
        id: 'mock_tx_4',
        type: 'income',
        title: 'Dự án thiết kế Landing Page',
        category: 'Dự án ngoài',
        amount: 4200000,
        date: dm5,
        bookingId: '',
        notes: 'Thanh toán đợt cuối',
        isMock: true
      },
      {
        id: 'mock_tx_5',
        type: 'expense',
        title: 'Thuê Studio & thiết bị ánh sáng',
        category: 'Đầu tư công việc',
        amount: 1250000,
        date: dm2,
        bookingId: '',
        notes: 'Phục vụ lịch quay Sora Jewelry',
        isMock: true
      },
      {
        id: 'mock_tx_6',
        type: 'expense',
        title: 'Cà phê làm việc & ăn trưa gặp khách',
        category: 'Ăn uống',
        amount: 340000,
        date: dm1,
        bookingId: '',
        notes: '',
        isMock: true
      },
      {
        id: 'mock_tx_7',
        type: 'expense',
        title: 'Di chuyển Grab & xăng xe',
        category: 'Di chuyển',
        amount: 420000,
        date: d0,
        bookingId: '',
        notes: 'Đi lại các lịch hẹn tuần này',
        isMock: true
      },
      {
        id: 'mock_tx_8',
        type: 'expense',
        title: 'Gia hạn công cụ Cloud & phần mềm',
        category: 'Đầu tư công việc',
        amount: 590000,
        date: dm4,
        bookingId: '',
        notes: 'iCloud + Canva Pro',
        isMock: true
      }
    ];

    const notes = [
      {
        id: 'mock_note_1',
        title: 'Checklist chuẩn bị trước buổi Booking',
        content: '• Pin máy + thẻ nhớ dự phòng\n• Gửi lại địa chỉ & giờ hẹn cho khách trước 2 tiếng\n• Xác nhận trang phục / đạo cụ & thanh toán phần còn lại sau buổi chụp',
        tags: ['Booking', 'Quy trình'],
        tint: 'cream',
        pinned: true,
        isMock: true,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
      },
      {
        id: 'mock_note_2',
        title: 'Ý tưởng gói dịch vụ mùa lễ hội',
        content: 'Tạo combo Mini Lookbook 90 phút tặng kèm 1 video Reels hậu trường 15s. Giá ưu đãi cho khách đặt cọc sớm trước 10 ngày.',
        tags: ['Ý tưởng', 'Marketing'],
        tint: 'rose',
        pinned: true,
        isMock: true,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'mock_note_3',
        title: 'Thông tin khách Chị Minh Thư',
        content: 'SĐT: 0909 xxx 882\nGu thẩm mỹ: Tối giản, nền kem/trắng, ánh sáng nắng chiều. Cần xuất ảnh chọn lọc trong 48h.',
        tags: ['Khách hàng'],
        tint: 'sky',
        pinned: false,
        isMock: true,
        createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
      },
      {
        id: 'mock_note_4',
        title: 'Sách muốn đọc tháng này',
        content: '1. Atomic Habits (đọc lại chương thói quen)\n2. Show Your Work — Austin Kleon\n3. Company of One',
        tags: ['Cá nhân'],
        tint: 'mint',
        pinned: false,
        isMock: true,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ];

    const projects = [
      {
        id: 'mock_proj_1',
        title: 'Ra mắt Website Portfolio & Booking 2026',
        description: 'Tối ưu trải nghiệm đặt lịch tự động và trưng bày các dự án nổi bật.',
        status: 'doing', // idea | doing | done
        deadline: d5,
        subtasks: [
          { id: 'st1', text: 'Chọn 6 bộ ảnh case study đẹp nhất', done: true },
          { id: 'st2', text: 'Viết bảng giá các gói dịch vụ rõ ràng', done: true },
          { id: 'st3', text: 'Gắn nút đặt lịch & liên kết Zalo/Instagram', done: false },
          { id: 'st4', text: 'Kiểm tra hiển thị trên điện thoại', done: false }
        ],
        isMock: true
      },
      {
        id: 'mock_proj_2',
        title: 'Chiến dịch nội dung Reels 30 ngày',
        description: 'Chia sẻ hậu trường làm việc, tips sắp xếp lịch trình và chăm sóc khách hàng.',
        status: 'idea',
        deadline: toDateKey(addDays(now, 14)),
        subtasks: [
          { id: 'st5', text: 'Lên danh sách 15 chủ đề gần gũi', done: true },
          { id: 'st6', text: 'Quay batch 5 video đầu tiên', done: false },
          { id: 'st7', text: 'Thiết kế mẫu chữ bìa đồng bộ', done: false }
        ],
        isMock: true
      },
      {
        id: 'mock_proj_3',
        title: 'Chuẩn hóa quy trình hợp đồng & biên nhận cọc',
        description: 'Tạo mẫu PDF gửi khách chuyên nghiệp và đồng bộ vào ShuShu Finance.',
        status: 'done',
        deadline: dm1,
        subtasks: [
          { id: 'st8', text: 'Soạn mẫu điều khoản dời lịch/hủy cọc', done: true },
          { id: 'st9', text: 'Thiết kế template biên nhận có mã QR', done: true }
        ],
        isMock: true
      }
    ];

    const clients = [
      {
        id: 'mock_cli_1',
        name: 'Chị Minh Thư',
        phone: '0909 412 882',
        zalo: '0909412882',
        location: 'Studio Quận 1',
        notes: 'Thích tone màu ánh sáng tự nhiên, nền kem/trắng, giao ảnh chọn lọc trong 48h.',
        isMock: true,
        createdAt: new Date(Date.now() - 86400000 * 14).toISOString()
      },
      {
        id: 'mock_cli_2',
        name: 'Anh Gia Huy',
        phone: '0938 776 190',
        zalo: '0938776190',
        location: 'Thảo Điền, TP. Thủ Đức',
        notes: 'Khách VIP thường đặt gói sự kiện & tư vấn concept cuối năm, thanh toán rất đúng hẹn.',
        isMock: true,
        createdAt: new Date(Date.now() - 86400000 * 20).toISOString()
      },
      {
        id: 'mock_cli_3',
        name: 'Bạn Ngọc Anh',
        phone: '0972 115 604',
        zalo: '0972115604',
        location: 'The Workshop Cafe, Q1',
        notes: 'Quan tâm Workshop 1-1 buổi chiều cuối tuần.',
        isMock: true,
        createdAt: new Date(Date.now() - 86400000 * 6).toISOString()
      },
      {
        id: 'mock_cli_4',
        name: 'Sora Jewelry',
        phone: '0918 552 309',
        zalo: '0918552309',
        location: 'Quận 3, TP.HCM',
        notes: 'Thương hiệu trang sức bạc — hay đặt quay Reels sản phẩm định kỳ mỗi tháng.',
        isMock: true,
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString()
      }
    ];

    return {
      version: 2,
      tasks,
      habits,
      reminders,
      transactions,
      notes,
      projects,
      clients,
      theme: getDefaultTheme(),
      settings: getDefaultSettings(),
      updatedAt: new Date().toISOString()
    };
  }
