import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Language, UserProfile } from './types';
import { translations } from './translations';
import { GoogleGenAI } from "@google/genai";

declare const firebase: any;

const SHEET_URL = "https://script.google.com/macros/s/AKfycbyFk3dq1LQ7XmSqfLPZH2MSn3PEmu2jk_Fh6_vtccCvjIi-eCwIWoXkSwtdvu1slVw/exec";

// --- UTILITY: Image Optimization (Canvas) ---
const optimizeImageForUpload = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 512; // Optimized for header size
                let width = img.width;
                let height = img.height;

                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject(new Error("Canvas Context Error"));

                // Transparent background for PNG/WebP
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Compression failed"));
                }, 'image/webp', 0.85); // High quality WebP
            };
            img.onerror = () => reject(new Error("Image loading failed"));
        };
        reader.onerror = () => reject(new Error("File reading failed"));
    });
};

const Logo: React.FC<{ className?: string, iconSize?: string, customUrl?: string }> = ({ className, iconSize = "text-xl", customUrl }) => {
    const [srcIndex, setSrcIndex] = useState(0);
    
    // Priority: Custom URL (Firebase) -> Local logo.png -> Cloud Backup
    const sources = useMemo(() => {
        const list = [];
        if (customUrl) list.push(customUrl);
        list.push('./logo.png');
        list.push('https://i.ibb.co/b5c0zgmG/Logo.jpg');
        return list;
    }, [customUrl]);

    useEffect(() => {
        setSrcIndex(0);
    }, [customUrl]);

    const handleError = () => {
        if (srcIndex < sources.length - 1) {
            setSrcIndex(srcIndex + 1);
        } else {
            setSrcIndex(-1); // Use icon fallback
        }
    };

    if (srcIndex === -1) {
        return (
            <div className={`${className} bg-white flex items-center justify-center text-[#3498db] shadow-inner overflow-hidden border border-gray-100`}>
                <i className={`fas fa-hand-holding-heart ${iconSize}`}></i>
            </div>
        );
    }

    return (
        <img 
            src={sources[srcIndex]} 
            alt="Miri Care Connect Logo" 
            className={`${className} object-contain`}
            onError={handleError}
            crossOrigin="anonymous"
        />
    );
};

const MenuItem: React.FC<{icon: string, label: string, onClick: () => void, active?: boolean}> = ({icon, label, onClick, active}) => (
    <button onClick={onClick} className={`flex items-center gap-3 sm:gap-5 p-3 sm:p-5 rounded-xl sm:rounded-2xl transition-all menu-item-btn ${active ? 'bg-[#3498db] text-white shadow-xl scale-105' : 'text-gray-400 hover:bg-gray-50'}`}>
        <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-left">{label}</span>
    </button>
);

const AdminInput: React.FC<{label: string, value: any, onChange?: (v: any) => void, type?: string, disabled?: boolean, placeholder?: string, min?: string}> = ({label, value, onChange, type = 'text', disabled = false, placeholder, min}) => (
    <div className="space-y-2">
        <label className="text-[8px] font-black uppercase text-gray-400 tracking-[0.2em] ml-1">{label}</label>
        <input 
            type={type} 
            value={value} 
            disabled={disabled}
            placeholder={placeholder}
            min={min}
            onChange={e => onChange?.(type === 'number' ? Number(e.target.value) : e.target.value)}
            className={`w-full p-3 rounded-xl border-2 font-bold transition-all text-sm outline-none ${disabled ? 'bg-gray-50 border-gray-50 text-gray-300' : 'bg-white border-gray-100 focus:border-[#3498db] text-[#2c3e50]'}`}
        />
    </div>
);

const OffersPage: React.FC<{ t: any, user: any }> = ({ t, user }) => {
    const [donations, setDonations] = useState<any[]>([]);
    const isAdmin = user?.isAdmin || user?.email === 'admin@gmail.com';

    useEffect(() => {
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        const unsubDonations = db.collection('donations').onSnapshot((snap: any) => {
            const data = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
            data.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            setDonations(data);
        });

        return () => { unsubDonations(); };
    }, []);

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-12 animate-in fade-in duration-500 offers-page-container">
            <div className="flex justify-between items-center border-b-4 border-[#2c3e50] pb-4">
                <h1 className="text-4xl font-black italic uppercase text-[#2c3e50] tracking-tighter">
                    {t('offers')}
                </h1>
            </div>

            {user && (
                <section className="space-y-6 px-2">
                    <h2 className="text-xl font-black text-[#2c3e50] uppercase italic tracking-tighter border-l-4 border-[#3498db] pl-4">{t('offer_help')}</h2>
                    {donations.length === 0 ? (
                        <div className="bg-white p-12 rounded-[2.5rem] border-4 border-dashed border-gray-100 text-center">
                            <p className="text-gray-400 font-black uppercase italic text-xs">{t('empty_offers_msg')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {donations.map(item => {
                                const dateObj = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
                                const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}`;
                                const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
                                const displayCategory = item.category?.startsWith('category_') ? t(item.category) : item.category;
                                
                                return (
                                    <div key={item.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-4">
                                            <h3 className="font-black text-[#2c3e50] uppercase truncate mr-2">{item.itemName}</h3>
                                            <span className="bg-blue-50 text-[#3498db] text-[9px] font-black px-2 py-1 rounded-full uppercase flex-shrink-0">{item.qty} qty</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase space-y-1">
                                            <p><i className="fas fa-tag mr-2 text-[#3498db] w-4"></i>{displayCategory}</p>
                                            {item.expiryDate && (
                                                <p className="text-red-500"><i className="fas fa-hourglass-end mr-2 text-red-500 w-4"></i>Exp: {item.expiryDate}</p>
                                            )}
                                            <p><i className="fas fa-user mr-2 text-[#3498db] w-4"></i>{item.donorName}</p>
                                            <p><i className="fas fa-school mr-2 text-[#3498db] w-4"></i>{item.userClass || 'N/A'}</p>
                                            <p><i className="fas fa-calendar mr-2 text-[#3498db] w-4"></i>{formattedDate} • {formattedTime}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
};

const ANNOUNCEMENT_CONTENT = {
    en: `Welcome to Miri Care Connect
Hello everyone!
Welcome to the official website of our Khidmat Masyarakat – Miri Care Connect.

We are currently available at SMK Lutong. If you have items at home that are no longer in use but are still in good condition, you are welcome to donate them through our platform. All donated items will be distributed to communities in need.

📍 Donation Venue:
Bilik Pengawas, SMK Lutong
(You may approach any prefect wearing a black coat, and they will guide you to the venue.)

🕒 Donation Schedule:
Monday / Tuesday / Friday
6:15 AM – 6:40 AM

Prefects will be on duty during these times to assist with the donation process.

All donated items will be verified by the Prefects. Once an item is confirmed to be in good and usable condition, it will be approved in our system, and reward points will be credited to your account. The number of points is determined by the prefects.

🎁 Reward Redemption:
Accumulated points can be redeemed for vouchers at the School Cooperative (Koperasi). Please remember the code (RD-XXXX) that given by the system. Cooperative prefect (Pengawas Koperasi) will search for your name in the name list through the code. So, the code is VERY IMPORTANT.

Thank you for supporting Miri Care Connect and helping us make a positive difference in our community 💙`,
    ms: `Selamat Datang ke Miri Care Connect
Helo semua!
Selamat datang ke laman web rasmi Khidmat Masyarakat kami – Miri Care Connect.

Kami kini berada di SMK Lutong. Jika anda mempunyai barang di rumah yang tidak lagi digunakan tetapi masih dalam keadaan baik, anda dialu-alukan untuk menyumbangkannya melalui platform kami. Semua barang yang disumbangkan akan diagihkan kepada komuniti yang memerlukan.

📍 Tempat Sumbangan:
Bilik Pengawas, SMK Lutong
(Anda boleh mendekati mana-mana pengawas yang memakai kot hitam, dan mereka akan memandu anda ke tempat tersebut.)

🕒 Jadual Sumbangan:
Isnin / Selasa / Jumaat
6:15 PAGI – 6:40 PAGI

Pengawas akan bertugas pada masa ini untuk membantu proses sumbangan.

Semua barang yang disumbangkan akan disahkan oleh Pengawas. Setelah barang disahkan berada dalam keadaan baik dan boleh digunakan, ia akan diluluskan dalam sistem kami, dan mata ganjaran akan dikreditkan ke akaun anda. Jumlah mata ditentukan oleh pengawas.

🎁 Penebusan Ganjaran:
Mata terkumpul boleh ditebus untuk baucar di Koperasi Sekolah. Sila ingat kod (RD-XXXX) yang diberikan oleh sistem. Pengawas Koperasi akan mencari nama anda dalam senarai nama melalui kod tersebut. Jadi, kod itu SANGAT PENTING.

Terima kasih kerana menyokong Miri Care Connect dan membantu kami membuat perbezaan positif dalam komuniti kami 💙`,
    zh: `欢迎来到 Miri Care Connect
大家好！
欢迎来到我们的社区服务官方网站 – Miri Care Connect。

我们目前在 SMK Lutong 提供服务。如果您家里有不再使用但状况良好的物品，欢迎通过我们的平台捐赠。所有捐赠的物品将分发给有需要的社区。

📍 捐赠地点：
Bilik Pengawas, SMK Lutong
（您可以联系任何穿着黑色外套的巡查员，他们会指引您前往地点。）

🕒 捐赠时间表：
星期一 / 星期二 / 星期五
早上 6:15 – 早上 6:40

巡查员将在这些时间值班，协助捐赠过程。

所有捐赠的物品将由巡查员核实。一旦确认物品状况良好且可用，它将在我们的系统中获得批准，奖励积分将记入您的帐户。积分数量由巡查员决定。

🎁 奖励兑换：
累积的积分可以在学校合作社（Koperasi）兑换代金券。请记住系统给出的代码（RD-XXXX）。合作社巡查员（Pengawas Koperasi）将通过代码在名单中搜索您的名字。所以，代码非常重要。

感谢您支持 Miri Care Connect 并帮助我们在社区中做出积极的改变 💙`,
    bi: `Selamat Datai ngagai Miri Care Connect
Hello semua!
Selamat datai ngagai laman web rasmi Khidmat Masyarakat kami – Miri Care Connect.

Kami diatu bisi di SMK Lutong. Enti kita bisi barang ba rumah ti enda agi dikena tang agi manah, kita diperansang meri barang nya nengah platform kami. Semua barang ti diberi deka diagih ngagai komuniti ti begunaka bantu.

📍 Endur Meri Barang:
Bilik Pengawas, SMK Lutong
(Kita tau nanya sebarang pengawas ti ngena baju kot chelum, lalu sida deka mai kita ngagai endur nya.)

🕒 Jadual Meri Barang:
Hari Satu / Hari Dua / Hari Lima
6:15 Pagi – 6:40 Pagi

Pengawas deka bertugas maya tu kena mantu proses meri barang.

Semua barang ti diberi deka diperiksa ulih Pengawas. Pengudah barang disahka manah sereta tau dikena, ia deka dikemendarka dalam sistem kami, lalu poin upah deka dikredit ngagai akaun kita. Penyampau poin deka ditetapka ulih pengawas.

🎁 Penukar Upah:
Poin ti udah digumpul tau ditukar nyadi baucar ba Koperasi Sekolah. Tulung ingat kod (RD-XXXX) ti diberi sistem. Pengawas Koperasi deka ngiga nama kita dalam lis nama nengah kod nya. Nya alai, kod nya CHUKUP PENTING.

Terima kasih laban nyukung Miri Care Connect sereta mantu kami ngaga ubah ti manah dalam komuniti kami 💙`
};

const GUIDE_CONTENT = {
    en: `Step 1: Register / Log In
Create an account using your moe account.
At the initial stage, Miri Care Connect is available for SMK Lutong students only.

Step 2: Submit a Donation
After logging in, register your donation by:
Selecting the type of item (e.g. clothes, books, daily necessities)
Entering the quantity
Submitting the donation through the system
⚠️ Please ensure all items are clean, safe, and in good usable condition.

Step 3: Check Drop-Off Details
Available drop-off day and time
Drop-off location: Bilik Pengawas, SMK Lutong
📅 Donation Days: Monday / Tuesday / Friday
🕒 Time: 6:15 AM – 6:50 AM
You may approach any prefect wearing a black coat for assistance.

Step 4: Submit Items for Verification
Bring your items to the venue at the scheduled time.
Prefects on duty will receive and inspect the items.

Step 5: Donation Verification
1. The Prefects will verify whether:
- The item is in good condition
- The item is suitable for donation
2. Your donation status will be updated in the system as:
- Approved
- Not Approved

Step 6: Earn Reward Points
For every approved donation, reward points will be determined by prefects after checking items and points will be credited to your account.

Step 7: Redeem Rewards
Accumulated points can be used to redeem vouchers at the "Point Shop", subject to availability and terms. After that, you can go to Koperasi and redeem the items you want such as book, ice-cream, or anything.
 
Important Notes:
1. Donations must follow the scheduled time and location.
2. Items that are damaged or unusable may not be approved.
3. All approved items will be distributed to communities in need (Kampung Pengkalan) through our project team.

Miri Care Connect aims to encourage kindness, reduce waste, and support those in need through a transparent and meaningful donation system.`,
    ms: `Langkah 1: Daftar / Log Masuk
Buat akaun menggunakan akaun moe anda.
Pada peringkat awal, Miri Care Connect hanya tersedia untuk pelajar SMK Lutong sahaja.

Langkah 2: Hantar Sumbangan
Selepas log masuk, daftarkan sumbangan anda dengan:
Memilih jenis barang (contoh: pakaian, buku, keperluan harian)
Memasukkan kuantiti
Menghantar sumbangan melalui sistem
⚠️ Sila pastikan semua barang bersih, selamat, dan dalam keadaan baik untuk digunakan.

Langkah 3: Semak Butiran Penyerahan
Hari dan masa penyerahan yang tersedia
Lokasi penyerahan: Bilik Pengawas, SMK Lutong
📅 Hari Sumbangan: Isnin / Selasa / Jumaat
🕒 Masa: 6:15 PAGI – 6:50 PAGI
Anda boleh mendekati mana-mana pengawas yang memakai kot hitam untuk bantuan.

Langkah 4: Hantar Barang untuk Pengesahan
Bawa barang anda ke tempat tersebut pada masa yang dijadualkan.
Pengawas yang bertugas akan menerima dan memeriksa barang tersebut.

Langkah 5: Pengesahan Sumbangan
1. Pengawas akan mengesahkan sama ada:
- Barang tersebut dalam keadaan baik
- Barang tersebut sesuai untuk disumbangkan
2. Status sumbangan anda akan dikemaskini dalam sistem sebagai:
- Diluluskan
- Tidak Diluluskan

Langkah 6: Dapatkan Mata Ganjaran
Untuk setiap sumbangan yang diluluskan, mata ganjaran akan ditentukan oleh pengawas selepas memeriksa barang dan mata akan dikreditkan ke akaun anda.

Langkah 7: Tebus Ganjaran
Mata terkumpul boleh digunakan untuk menebus baucar di "Kedai Mata", tertakluk kepada ketersediaan dan terma. Selepas itu, anda boleh pergi ke Koperasi dan menebus barang yang anda mahukan seperti buku, aiskrim, atau apa sahaja.

Nota Penting:
1. Sumbangan mesti mengikut masa dan lokasi yang dijadualkan.
2. Barang yang rosak atau tidak boleh digunakan mungkin tidak diluluskan.
3. Semua barang yang diluluskan akan diagihkan kepada komuniti yang memerlukan (Kampung Pengkalan) melalui pasukan projek kami.

Miri Care Connect bertujuan untuk menggalakkan kebaikan, mengurangkan pembaziran, dan menyokong mereka yang memerlukan melalui sistem sumbangan yang telus dan bermakna.`,
    zh: `步骤 1：注册 / 登录
使用您的 moe 帐户创建一个帐户。
在初始阶段，Miri Care Connect 仅供 SMK Lutong 学生使用。

步骤 2：提交捐赠
登录后，通过以下方式登记您的捐赠：
选择物品类型（例如衣服、书籍、日用品）
输入数量
通过系统提交捐赠
⚠️ 请确保所有物品干净、安全且状况良好可用。

步骤 3：检查投放详情
可用的投放日期和时间
投放地点：Bilik Pengawas, SMK Lutong
📅 捐赠日：星期一 / 星期二 / 星期五
🕒 时间：早上 6:15 – 早上 6:50
您可以联系任何穿着黑色外套的巡查员寻求帮助。

步骤 4：提交物品进行核实
在预定时间将您的物品带到地点。
值班巡查员将接收并检查物品。

步骤 5：捐赠核实
1. 巡查员将核实：
- 物品状况良好
- 物品适合捐赠
2. 您的捐赠状态将在系统中更新为：
- 已批准
- 未批准

步骤 6：赚取奖励积分
对于每一项获批的捐赠，奖励积分将由巡查员在检查物品后决定，积分将记入您的帐户。

步骤 7：兑换奖励
累积的积分可用于在“积分商店”兑换代金券，视供应情况和条款而定。之后，您可以去合作社兑换您想要的物品，如书籍、冰淇淋或任何东西。

重要提示：
1. 捐赠必须遵守预定的时间和地点。
2. 损坏或无法使用的物品可能不被批准。
3. 所有获批的物品将通过我们的项目团队分发给有需要的社区（Kampung Pengkalan）。

Miri Care Connect 旨在通过透明和有意义的捐赠系统鼓励善意，减少浪费并支持有需要的人。`,
    bi: `Langkah 1: Rejista / Log Masuk
Gaga akaun ngena akaun moe kita.
Ba renggat tumu, Miri Care Connect semina dibuka ngagai nembiak SMK Lutong aja.

Langkah 2: Hantar Pemeri
Pengudah log masuk, rejista pemeri kita ngena chara:
Milih bansa barang (chunto: gari, bup, keperluan ninting hari)
Masuk ke penyampau
Nghantar pemeri nengah sistem
⚠️ Tulung tentuka semua barang beresi, selamat, enggau manah dikena.

Langkah 3: Periksa Penerang Nganjung
Hari enggau masa nganjung ti bisi
Endur nganjung: Bilik Pengawas, SMK Lutong
📅 Hari Meri: Hari Satu / Hari Dua / Hari Lima
🕒 Masa: 6:15 Pagi – 6:50 Pagi
Kita tau nanya sebarang pengawas ti ngena baju kot chelum minta tulung.

Langkah 4: Hantar Barang ngambika Diperiksa
Bai barang kita ngagai endur nya maya masa ti udah ditetapka.
Pengawas ti bertugas deka nerima lalu meriksa barang nya.

Langkah 5: Pengesahan Pemeri
1. Pengawas deka nentuka sekalika:
- Barang nya manah
- Barang nya patut diberi
2. Status pemeri kita deka diubah dalam sistem nyadi:
- Dikemendarka
- Enda Dikemendarka

Langkah 6: Ulih Poin Upah
Ungkup tetiap pemeri ti dikemendarka, poin upah deka ditetapka pengawas pengudah meriksa barang lalu poin deka dikredit ngagai akaun kita.

Langkah 7: Tukar Upah
Poin ti udah digumpul tau dikena nukar baucar ba "Kedai Poin", bepanggai ba stok enggau atur. Pengudah nya, kita tau ngagai Koperasi lalu nukar barang ti dikedeka kita baka bup, aiskrim, tauka nama-nama aja.

Nota Penting:
1. Pemeri mesti nitihka masa enggau endur ti dijadualka.
2. Barang ti rusak tauka enda ulih dikena engka enda dikemendarka.
3. Semua barang ti dikemendarka deka diagih ngagai komuniti ti begunaka bantu (Kampung Pengkalan) nengah tim projek kami.

Miri Care Connect bisi tuju deka ngansak penyiru, ngurangka pengerusak, enggau nyukung sida ti begunaka bantu nengah sistem pemeri ti telus enggau bermakna.`
};

const HomePage: React.FC<{ t: any, user: any, lang: Language }> = ({ t, user, lang }) => {
    // Announcement state removed as we use hardcoded content now
    // Guide state removed as we use hardcoded content now
    
    const isAdmin = user?.isAdmin || user?.email === 'admin@gmail.com';
    
    useEffect(() => {
        // Listeners removed as we use hardcoded content
    }, []);

    const getAnnouncementText = () => {
        if (lang === Language.BM) return ANNOUNCEMENT_CONTENT.ms;
        if (lang === Language.BC) return ANNOUNCEMENT_CONTENT.zh;
        if (lang === Language.BI) return ANNOUNCEMENT_CONTENT.bi;
        return ANNOUNCEMENT_CONTENT.en;
    };

    const getGuideText = () => {
        if (lang === Language.BM) return GUIDE_CONTENT.ms;
        if (lang === Language.BC) return GUIDE_CONTENT.zh;
        if (lang === Language.BI) return GUIDE_CONTENT.bi;
        return GUIDE_CONTENT.en;
    };

    return (
        <div className="space-y-8 py-4 sm:py-8 max-w-6xl mx-auto">
            {!user && (
                <div className="bg-[#2c3e50] text-white rounded-[2.5rem] p-8 sm:p-16 text-center shadow-2xl relative overflow-hidden border-b-[10px] border-[#3498db] animate-in fade-in zoom-in duration-500">
                    <h1 className="text-4xl sm:text-7xl font-black italic uppercase tracking-tighter leading-tight mb-4">
                        Connecting Miri Citizens In Need
                    </h1>
                    <p className="text-gray-400 font-bold uppercase text-sm sm:text-lg tracking-widest">
                        SHARE YOUR EXTRA ITEMS WITH OTHERS THAT NEED HELP
                    </p>
                </div>
            )}

            <div className="space-y-4 px-2">
                <div className="flex justify-between items-end">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] ml-2">{t('announcements')}</h3>
                </div>
                
                <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 sm:p-12 shadow-sm relative transition-all">
                    <div className="flex gap-4 sm:gap-6">
                        <div className="w-10 h-10 flex-shrink-0 bg-blue-50 rounded-full flex items-center justify-center text-[#3498db]">
                            <i className="fas fa-bullhorn"></i>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-black text-[#2c3e50] uppercase italic mb-1">{t('announcement_title')}</h4>
                            <div className="whitespace-pre-wrap font-bold text-[#2c3e50] text-sm leading-relaxed">
                                {getAnnouncementText()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 px-2 pt-8 border-t border-gray-100">
                <div className="flex justify-between items-end">
                    <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] ml-2">{t('user_guide')}</h3>
                </div>
                <div className="bg-white rounded-[2.5rem] border border-gray-100 p-8 sm:p-12 shadow-sm relative transition-all min-h-[300px]">
                    <div className="whitespace-pre-wrap font-bold text-[#2c3e50] text-sm leading-relaxed">
                        {getGuideText()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const App: React.FC = () => {
    const [lang, setLang] = useState<Language>(Language.EN);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [user, setUser] = useState<any | null>(null);
    const [page, setPage] = useState<string>('home');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [itemToRedeem, setItemToRedeem] = useState<any>(null);
    const [showAdminPanel, setShowAdminPanel] = useState(false);
    const [showSupportChat, setShowSupportChat] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [guestId, setGuestId] = useState<string>('');
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [isQuickOfferOpen, setIsQuickOfferOpen] = useState(false);
    const [emailVerified, setEmailVerified] = useState(true);
    const [redeemSuccessCode, setRedeemSuccessCode] = useState<string | null>(null);
    
    // --- GOOGLE SHEETS INTEGRATION ---
    const [sheetInventory, setSheetInventory] = useState<string[]>([]);

    useEffect(() => {
        const fetchActiveItems = async () => {
            try {
                const res = await fetch(SHEET_URL, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                    },
                    cache: 'no-cache'
                });
                
                if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
                
                const items = await res.json();
                if (Array.isArray(items)) {
                    setSheetInventory(items);
                } else {
                    console.warn("Inventory data is not an array:", items);
                    setSheetInventory([]);
                }
            } catch (e) {
                console.error("Could not load inventory from Sheets", e);
                // Fallback to some default items if fetch fails to keep the app functional
                setSheetInventory(['Food Pack', 'Water Bottle', 'Medical Kit', 'Clothing', 'Hygiene Kit']);
            }
        };
        fetchActiveItems();
    }, []);

    // 1. Function to log Redemptions
    const syncRedemption = async (user: any, itemName: string) => {
        try {
            await fetch(SHEET_URL, {
                method: 'POST',
                mode: 'no-cors', 
                body: JSON.stringify({
                    username: user.displayName,
                    email: user.email,
                    item: itemName
                })
            });
        } catch (err) {
            console.error("Redemption Sync Error:", err);
        }
    };

    // 2. Function to log New Users
    const syncNewUser = async (newUser: any) => {
        try {
            // This payload ensures the password reaches Column G based on our Master Script
            await fetch(SHEET_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    type: "REGISTRATION",
                    displayName: newUser.displayName,
                    email: newUser.email,
                    phone: newUser.phone,
                    userClass: newUser.userClass,
                    birthdate: newUser.birthdate,
                    address: newUser.address,
                    password: newUser.password // This maps to Column G
                })
            });
        } catch (err) {
            console.error("Registration Sync Error:", err);
        }
    };
    // ---------------------------------
    
    // BRANDING STATES
    const [branding, setBranding] = useState<{logoUrl?: string}>({});
    const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
    const [logoPreview, setLogoPreview] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Ref to manage the active upload task for cancellation/cleanup
    const uploadTaskRef = useRef<any>(null);
    
    const t = useCallback((key: string) => translations[lang][key] || key, [lang]);

    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isMenuOpen]);

    useEffect(() => {
        let storedGuestId = sessionStorage.getItem('support_guest_id');
        if (!storedGuestId) {
            storedGuestId = 'guest_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('support_guest_id', storedGuestId);
        }
        setGuestId(storedGuestId);
    }, []);

    useEffect(() => {
        let unsubscribeAuth: () => void = () => {};
        let unsubNotifs: () => void = () => {};
        let unsubBranding: () => void = () => {};

        const initFirebase = async () => {
            if (typeof firebase === 'undefined' || !firebase.auth) {
                setTimeout(initFirebase, 500);
                return;
            }

            try {
                const firebaseConfig = {
                    apiKey: "AIzaSyDOl93LVxhrfcz04Kj2D2dSQkp22jaeiog",
                    authDomain: "miri-care-connect-95a63.firebaseapp.com",
                    projectId: "miri-care-connect-95a63",
                    storageBucket: "miri-care-connect-95a63.firebasestorage.app",
                    messagingSenderId: "419556521920",
                    appId: "1:419556521920:web:628bc9d7195fca073a3a25",
                    measurementId: "G-7F4LG9P6EC"
                };

                if (!firebase.apps || !firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }

                const db = firebase.firestore();

                unsubBranding = db.collection('settings').doc('branding').onSnapshot((doc: any) => {
                    if (doc.exists) {
                        const data = doc.data();
                        setBranding(data);
                        setLogoPreview(data.logoUrl || '');
                    }
                });

                unsubscribeAuth = firebase.auth().onAuthStateChanged(async (authUser: any) => {
                    if (authUser) {
                        const isHardcodedAdmin = authUser.email === 'admin@gmail.com';
                        const isKoperasi = authUser.email === 'koperasi@gmail.com';
                        await authUser.reload();
                        setEmailVerified(!!authUser.emailVerified || isHardcodedAdmin || isKoperasi);
                        
                        db.collection('users').doc(authUser.uid).onSnapshot(async (doc: any) => {
                            if (doc.exists) {
                                const data = doc.data();
                                setUser({ ...data, uid: authUser.uid });
                                if (isKoperasi) setPage('admin');
                            } else {
                                const profile = { 
                                    uid: authUser.uid, 
                                    email: authUser.email, 
                                    displayName: isHardcodedAdmin ? 'System Admin' : (isKoperasi ? 'Koperasi' : 'Guest'),
                                    points: 5, 
                                    isAdmin: isHardcodedAdmin, 
                                    isKoperasi: isKoperasi 
                                };
                                await db.collection('users').doc(authUser.uid).set(profile);
                                setUser(profile as any);
                                if (isKoperasi) setPage('admin');
                            }
                        }, (err: any) => {});

                        unsubNotifs = db.collection('notifications')
                            .where('userId', '==', authUser.uid)
                            .onSnapshot((snap: any) => {
                                const notifs = snap.docs.map((d: any) => ({ 
                                    id: d.id, 
                                    ...d.data(),
                                    createdAtMillis: d.data().createdAt?.toMillis?.() || 0
                                }));
                                notifs.sort((a: any, b: any) => b.createdAtMillis - a.createdAtMillis);
                                setNotifications(notifs);
                            }, (err: any) => {});
                    } else { 
                        setUser(null); 
                        setNotifications([]);
                        setEmailVerified(true);
                        setPage('home');
                        if (unsubNotifs) unsubNotifs();
                    }
                    setLoading(false);
                }, (err: any) => {
                    setLoading(false);
                });
            } catch (err) {
                setLoading(false);
            }
        };

        initFirebase();
        return () => {
            if (unsubscribeAuth) unsubscribeAuth();
            if (unsubNotifs) unsubNotifs();
            if (unsubBranding) unsubBranding();
            if (uploadTaskRef.current) {
                try { uploadTaskRef.current.cancel(); } catch(e) {}
            }
        };
    }, []);

    const isAdmin = user?.isAdmin || user?.email === 'admin@gmail.com';
    const isKoperasi = user?.isKoperasi || user?.email === 'koperasi@gmail.com';

    // ROBUST LOGO UPLOAD (STABILIZED FOR POOR CONNECTIONS)
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];

        // 1. Validation
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert("Please upload a valid image (PNG, JPG, or WebP).");
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert("File size too large. Please select an image under 5MB.");
            return;
        }

        setUploading(true);
        setUploadProgress(5);
        
        try {
            // 2. Optimized Image Processing
            const optimizedBlob = await optimizeImageForUpload(file);
            setUploadProgress(10); // Ready to upload

            if (typeof firebase === 'undefined' || !firebase.storage) {
                throw new Error("Firebase Storage not initialized.");
            }

            const storage = firebase.storage();
            const db = firebase.firestore();

            // 3. Reliable Recursive Upload Session
            const performUploadWithRetry = (blob: Blob, retryCount = 0): Promise<string> => {
                return new Promise((resolve, reject) => {
                    // Use a unique name for each attempt to bypass any hung server state
                    const uniqueFileName = `branding/logo_${Date.now()}.webp`;
                    const logoRef = storage.ref().child(uniqueFileName);

                    // Cancel any previous hung task safely
                    if (uploadTaskRef.current) {
                        try { uploadTaskRef.current.cancel(); } catch(e) {}
                    }

                    const task = logoRef.put(blob, { 
                        contentType: 'image/webp',
                        cacheControl: 'public,max-age=3600'
                    });
                    uploadTaskRef.current = task;

                    // WATCHDOG SETUP:
                    // We detect stalls by tracking bytesTransferred over time.
                    let lastBytesTransferred = 0;
                    let lastProgressTime = Date.now();
                    const startTime = Date.now();
                    
                    const watchdogInterval = setInterval(() => {
                        const now = Date.now();
                        const timeSinceStart = now - startTime;
                        const timeSinceProgress = now - lastProgressTime;
                        
                        // GRACE PERIOD: 
                        // Allow up to 60 seconds for the initial connection handshake.
                        if (lastBytesTransferred === 0 && timeSinceStart < 60000) return;

                        // STALL DETECTION: 
                        // If we have started but haven't moved for 25 seconds, force-fail for retry.
                        if (timeSinceProgress > 25000) {
                            console.warn(`Upload stalled at ${lastBytesTransferred} bytes for ${timeSinceProgress}ms. Restarting...`);
                            clearInterval(watchdogInterval);
                            task.cancel();
                            // Task cancellation triggers the error handler below
                        }
                    }, 5000);

                    task.on(firebase.storage.TaskEvent.STATE_CHANGED, 
                        (snapshot: any) => {
                            if (snapshot.bytesTransferred > lastBytesTransferred) {
                                lastBytesTransferred = snapshot.bytesTransferred;
                                lastProgressTime = Date.now();
                            }

                            // Progress scaling: 10% processing + 90% actual network upload
                            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 90) + 10;
                            setUploadProgress(pct);
                        },
                        async (error: any) => {
                            clearInterval(watchdogInterval);
                            
                            // AUTO-RETRY LOGIC: 
                            // Only retry on network timeouts, cancellations, or generic storage errors
                            const retryableErrors = ['storage/canceled', 'storage/retry-limit-exceeded', 'storage/unknown', 'storage/internal-error'];
                            if (retryableErrors.includes(error.code) && retryCount < 3) {
                                const backoff = Math.pow(2, retryCount) * 1500;
                                console.log(`Connection weak. Retrying attempt ${retryCount + 1} in ${backoff}ms...`);
                                setTimeout(() => {
                                    resolve(performUploadWithRetry(blob, retryCount + 1));
                                }, backoff);
                            } else {
                                reject(error);
                            }
                        },
                        async () => {
                            clearInterval(watchdogInterval);
                            try {
                                const downloadURL = await logoRef.getDownloadURL();
                                resolve(downloadURL);
                            } catch (e) {
                                reject(e);
                            }
                        }
                    );
                });
            };

            // Start the optimized upload pipe
            const finalUrl = await performUploadWithRetry(optimizedBlob);

            // 4. Persistence: Update Firestore settings
            await db.collection('settings').doc('branding').set({ 
                logoUrl: finalUrl,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: user?.uid || 'admin'
            }, { merge: true });

            setUploading(false);
            setUploadProgress(0);
            setIsLogoModalOpen(false);
            alert("Site Branding Updated Successfully!");

        } catch (e: any) {
            console.error("Storage Error:", e);
            setUploading(false);
            setUploadProgress(0);
            
            let message = "Upload failed. ";
            if (e.code === 'storage/unauthorized') message += "Please login as admin again.";
            else if (e.code === 'storage/retry-limit-exceeded') message += "Your network is too unstable. Please try on a faster connection.";
            else message += e.message || "Unknown error.";
            
            alert(message);
        }
    };

    const removeLogo = async () => {
        if (!window.confirm("Remove logo and reset to default?")) return;
        setUploading(true);
        try {
            await firebase.firestore().collection('settings').doc('branding').set({ 
                logoUrl: firebase.firestore.FieldValue.delete() 
            }, { merge: true });
            setIsLogoModalOpen(false);
            alert("Logo removed.");
        } catch (e: any) {
            alert(e.message);
        } finally {
            setUploading(false);
        }
    };

    const markNotifRead = async (notification: any) => {
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        try {
            await firebase.firestore().collection('notifications').doc(notification.id).update({ read: true });
        } catch (e) {}
    };

    const resendVerification = async () => {
        try {
            if (firebase.auth().currentUser) {
                await firebase.auth().currentUser.sendEmailVerification();
                alert("Verification message sent, please check your moe email spam folder page");
            }
        } catch (e: any) {
            alert(e.message);
        }
    };

    if (loading) return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f8f9fa] text-[#3498db] font-black italic uppercase text-center">
            <i className="fas fa-spinner fa-spin text-5xl mb-4"></i>
            {t('loading_citizens')}
        </div>
    );

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className={`min-h-screen flex flex-col transition-colors duration-500 relative ${theme === 'dark' ? 'bg-[#050b18] text-white' : 'bg-[#f8f9fa] text-gray-900'}`} onClick={() => { setIsLangOpen(false); setIsQuickOfferOpen(false); }}>
            <style>{`
                .galaxy-bg {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: -1;
                    background: radial-gradient(circle at 50% 50%, #1b2735 0%, #090a0f 100%);
                    display: ${theme === 'dark' ? 'block' : 'none'};
                }
                .stars-container {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 0;
                }
                .star {
                    position: absolute;
                    background: white;
                    border-radius: 50%;
                    opacity: 0.5;
                }
                ${theme === 'dark' ? `
                    header { background: rgba(13, 25, 48, 0.9) !important; backdrop-filter: blur(10px); border-bottom: 1px solid rgba(255,255,255,0.1) !important; }
                    .bg-white { background: rgba(255, 255, 255, 0.05) !important; color: white !important; }
                    
                    /* Global Force White Text in Dark Mode */
                    *, *::before, *::after {
                        color: #f8f9fa !important;
                    }

                    /* Exceptions for buttons and specific status colors */
                    .bg-[#3498db] *, .bg-[#2ecc71] *, .bg-red-500 *, .bg-amber-500 *, .text-white, button, button * {
                        color: white !important;
                    }
                    
                    /* Keep specific status colors readable */
                    .text-red-500, .text-red-500 * { color: #ff6b6b !important; }
                    .text-green-500, .text-green-500 * { color: #51cf66 !important; }
                    .text-amber-500, .text-amber-500 * { color: #fcc419 !important; }
                    .text-blue-500, .text-blue-500 * { color: #339af0 !important; }
                    
                    /* Kindness Level Points - Force Orange */
                    .text-\\[\\#f39c12\\], .text-\\[\\#f39c12\\] * { 
                        color: #f39c12 !important; 
                    }

                    /* Announcement Title and other Dark Blue text - Force White */
                    .text-\\[\\#2c3e50\\], .text-\\[\\#2c3e50\\] * {
                        color: #f8f9fa !important;
                    }

                    /* Sidebar and Portals Backgrounds */
                    aside { background-color: #0d1930 !important; }
                    
                    /* Kindness Level Box Specific Fix */
                    .kindness-box { 
                        background: rgba(255, 255, 255, 0.05) !important; 
                        border: 1px solid rgba(255, 255, 255, 0.1) !important;
                    }
                    .kindness-box * {
                        color: #f8f9fa !important;
                    }
                    .kindness-box .text-\\[\\#f39c12\\] {
                        color: #f39c12 !important;
                    }

                    /* Notification Modal Fixes */
                    .notif-content {
                        background: #0d1930 !important;
                        border: 1px solid rgba(255,255,255,0.1) !important;
                    }
                    .notif-header {
                        background: rgba(255,255,255,0.05) !important;
                        border-bottom: 1px solid rgba(255,255,255,0.1) !important;
                    }
                    .notif-header h3 {
                        color: #f8f9fa !important;
                    }
                    .notif-content .bg-gray-200 {
                        background: rgba(255,255,255,0.1) !important;
                        color: #f8f9fa !important;
                    }
                    .notif-content .bg-blue-50\/50 {
                        background: rgba(52, 152, 219, 0.1) !important;
                        border-color: rgba(52, 152, 219, 0.2) !important;
                    }
                    .notif-content .text-gray-800 {
                        color: #f8f9fa !important;
                    }
                    .notif-content .text-gray-500 {
                        color: #adb5bd !important;
                    }
                    
                    /* Admin Chat Log Window Fix */
                    .bg-white.border.text-gray-800 {
                        background: rgba(255,255,255,0.1) !important;
                        border-color: rgba(255,255,255,0.1) !important;
                        color: #f8f9fa !important;
                    }
                    
                    /* History Page Specifics */
                    .bg-gray-100 { background: rgba(255,255,255,0.1) !important; }
                    .bg-white { background: rgba(255, 255, 255, 0.08) !important; border-color: rgba(255,255,255,0.1) !important; }
                    
                    /* Status Badges in Dark Mode */
                    .bg-amber-100, .bg-amber-50 { background: rgba(243, 156, 18, 0.2) !important; border: 1px solid rgba(243, 156, 18, 0.3) !important; color: #f39c12 !important; }
                    .bg-green-100, .bg-green-50 { background: rgba(46, 204, 113, 0.2) !important; border: 1px solid rgba(46, 204, 113, 0.3) !important; color: #2ecc71 !important; }
                    .bg-blue-100, .bg-blue-50 { background: rgba(52, 152, 219, 0.2) !important; border: 1px solid rgba(52, 152, 219, 0.3) !important; color: #3498db !important; }
                    .bg-red-100, .bg-red-50 { background: rgba(231, 76, 60, 0.2) !important; border: 1px solid rgba(231, 76, 60, 0.3) !important; color: #e74c3c !important; }
                    
                    /* Force text colors for badges */
                    .bg-amber-100 *, .bg-amber-50 *, .bg-green-100 *, .bg-green-50 *, .bg-blue-100 *, .bg-blue-50 *, .bg-red-100 *, .bg-red-50 * {
                        color: inherit !important;
                    }

                    /* Active Tab in History */
                    .bg-white.shadow-sm { background: rgba(255, 255, 255, 0.2) !important; }
                    
                    /* Menu Item Hover/Active */
                    .menu-item-btn:hover { 
                        background-color: rgba(52, 152, 219, 0.2) !important; 
                    }
                    .menu-item-btn:hover span {
                        color: #ffffff !important;
                    }
                    .bg-blue-50 { background: rgba(52, 152, 219, 0.2) !important; }

                    .bg-gray-50, .bg-[#f8f9fa], .bg-gray-100 { background: rgba(255,255,255,0.05) !important; }
                    .border-gray-100, .border-gray-200, .border-gray-50 { border-color: rgba(255,255,255,0.1) !important; }
                    input, textarea, select { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.2) !important; color: white !important; }
                    .theme-card, .bg-white { background: rgba(255, 255, 255, 0.05) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important; }
                    
                    /* General Text Colors */
                    .text-gray-300, .text-gray-400, .text-gray-500 { color: #adb5bd !important; }
                    .text-gray-600, .text-gray-700, .text-gray-800 { color: #f8f9fa !important; }
                    h1, h2, h3, h4, h5, h6, p, span, div, label { color: inherit; }
                    body { color: #f8f9fa; }
                    
                    /* Admin Panel & History Specifics */
                    .admin-panel-container, .history-page-container {
                        background: rgba(13, 25, 48, 0.95) !important;
                        border: 1px solid rgba(255, 255, 255, 0.1) !important;
                        color: #f8f9fa !important;
                    }
                    .admin-panel-container .bg-white, .history-page-container .bg-white { 
                        background: rgba(255, 255, 255, 0.05) !important; 
                        border-color: rgba(255, 255, 255, 0.1) !important;
                    }
                    
                    /* CRITICAL: Force text color overrides for Admin/History/Offers/Shop */
                    .admin-panel-container .text-\\[\\#2c3e50\\], 
                    .history-page-container .text-\\[\\#2c3e50\\],
                    .offers-page-container .text-\\[\\#2c3e50\\],
                    .shop-page-container .text-\\[\\#2c3e50\\],
                    .admin-panel-container [class*="text-[#2c3e50]"],
                    .history-page-container [class*="text-[#2c3e50]"],
                    .offers-page-container [class*="text-[#2c3e50]"],
                    .shop-page-container [class*="text-[#2c3e50]"] { 
                        color: #f8f9fa !important; 
                    }

                    /* CRITICAL: Input/Form overrides for Admin/History/Offers/Shop */
                    .admin-panel-container input, .admin-panel-container textarea, .admin-panel-container select,
                    .history-page-container input, .history-page-container textarea, .history-page-container select,
                    .offers-page-container input, .offers-page-container textarea, .offers-page-container select,
                    .shop-page-container input, .shop-page-container textarea, .shop-page-container select {
                        background-color: rgba(0, 0, 0, 0.4) !important;
                        color: #ffffff !important;
                        border: 1px solid rgba(255, 255, 255, 0.2) !important;
                    }
                    
                    .admin-panel-container input::placeholder, .admin-panel-container textarea::placeholder,
                    .offers-page-container input::placeholder, .offers-page-container textarea::placeholder,
                    .shop-page-container input::placeholder, .shop-page-container textarea::placeholder {
                        color: rgba(255, 255, 255, 0.4) !important;
                    }

                    /* Fix for bg-gray-50 containers (forms, details) */
                    .admin-panel-container .bg-gray-50, .history-page-container .bg-gray-50,
                    .offers-page-container .bg-gray-50, .shop-page-container .bg-gray-50 {
                        background-color: rgba(255, 255, 255, 0.03) !important;
                        border-color: rgba(255, 255, 255, 0.1) !important;
                        color: #f8f9fa !important;
                    }
                    
                    /* Fix for unreadable badges in dark mode */
                    .bg-green-50, .bg-green-100, .bg-green-500 {
                        background: rgba(46, 204, 113, 0.2) !important;
                        color: #2ecc71 !important;
                        border: 1px solid rgba(46, 204, 113, 0.4) !important;
                    }
                    .bg-green-50 *, .bg-green-100 *, .bg-green-500 * {
                        color: #2ecc71 !important;
                    }
                    
                    .bg-amber-50, .bg-amber-100, .bg-amber-500 {
                        background: rgba(243, 156, 18, 0.2) !important;
                        color: #f39c12 !important;
                        border: 1px solid rgba(243, 156, 18, 0.4) !important;
                    }
                    .bg-amber-50 *, .bg-amber-100 *, .bg-amber-500 * {
                        color: #f39c12 !important;
                    }
                    
                    .bg-blue-50, .bg-blue-100, .bg-blue-500 {
                        background: rgba(52, 152, 219, 0.2) !important;
                        color: #3498db !important;
                        border: 1px solid rgba(52, 152, 219, 0.4) !important;
                    }
                    .bg-blue-50 *, .bg-blue-100 *, .bg-blue-500 * {
                        color: #3498db !important;
                    }
                    
                    .shadow-xl, .shadow-2xl, .shadow-sm { box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4) !important; }
                    
                    /* Floating Buttons Outline Fix */
                    .border-white { border-color: transparent !important; }
                    .shadow-\[0_8px_32px_rgba\(52\,152\,219\,0\.3\)\] { box-shadow: none !important; }
                    .shadow-2xl { box-shadow: none !important; }
                ` : ''}
            `}</style>
            
            {theme === 'dark' && (
                <div className="galaxy-bg">
                    <div className="stars-container">
                        {[...Array(50)].map((_, i) => (
                            <div 
                                key={i} 
                                className="star animate-pulse" 
                                style={{
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                    width: `${1 + Math.random() * 2}px`,
                                    height: `${1 + Math.random() * 2}px`,
                                    animationDelay: `${Math.random() * 5}s`,
                                    animationDuration: `${2 + Math.random() * 3}s`
                                }}
                            />
                        ))}
                    </div>
                </div>
            )}
            <header className="bg-[#2c3e50] text-white shadow-xl sticky top-0 z-[100] h-16 sm:h-20 flex items-center">
                <div className="container mx-auto px-2 sm:px-4 flex items-center justify-between gap-1 overflow-hidden">
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(true); }} className="p-2 hover:bg-white/10 rounded-xl transition-all flex-shrink-0">
                        <i className="fas fa-bars text-lg sm:text-xl"></i>
                    </button>
                    
                    <div 
                        className="flex-grow flex items-center justify-center gap-2 sm:gap-3 py-1 cursor-pointer overflow-hidden px-1" 
                        onClick={() => { if (!isKoperasi) setPage('home'); }}
                    >
                        {/* BRANDING LOGO LEFT OF TEXT */}
                        <div className="relative group shrink-0" onClick={(e) => {
                            if (isAdmin) {
                                e.stopPropagation();
                                setIsLogoModalOpen(true);
                            }
                        }}>
                           <div className={`w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-white p-0.5 shadow-md flex-shrink-0 flex items-center justify-center overflow-hidden transition-all ${isAdmin ? 'ring-2 ring-dashed ring-[#3498db] hover:scale-110 active:scale-95' : ''}`}>
                                <Logo customUrl={branding.logoUrl} className="w-full h-full" iconSize="text-xs" />
                                {isAdmin && !branding.logoUrl && (
                                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <i className="fas fa-camera text-[8px] text-[#3498db]"></i>
                                    </div>
                                )}
                           </div>
                        </div>
                        <div className="font-black tracking-tighter text-[10px] xs:text-[13px] sm:text-lg whitespace-nowrap overflow-hidden">
                            Miri <span className="text-[#3498db]">Care</span> Connect
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1 sm:gap-4 flex-shrink-0">
                        {user && (
                            <div className="relative">
                                <button onClick={(e) => { e.stopPropagation(); setIsNotifOpen(true); }} className="p-2 hover:bg-white/10 rounded-full transition-all relative">
                                    <i className="fas fa-bell text-lg"></i>
                                    {unreadCount > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-black border-2 border-[#2c3e50]">{unreadCount}</span>}
                                </button>
                            </div>
                        )}
                        {user && !isKoperasi && (
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setPage('shop')}
                                    className="flex items-center bg-[#f39c12] hover:bg-[#e67e22] transition-colors px-2 sm:px-4 py-1 rounded-full text-[8px] sm:text-xs font-black shadow-lg whitespace-nowrap"
                                >
                                    <i className="fas fa-star mr-1 sm:mr-2"></i> 
                                    {user.points} <span className="ml-0.5">{t('points')}</span>
                                </button>
                            </div>
                        )}
                        {!user && (
                            <button onClick={(e) => { e.stopPropagation(); setIsAuthModalOpen(true); }} className="bg-[#3498db] hover:bg-blue-600 px-3 py-1.5 rounded-full text-[8px] sm:text-[10px] font-black uppercase shadow-lg">{t('login')}</button>
                        )}
                        {isKoperasi && (
                             <button 
                                onClick={() => firebase.auth().signOut()} 
                                className="bg-red-500 hover:bg-red-600 text-white px-2 sm:px-3 py-1 rounded-full text-[8px] sm:text-[10px] font-black uppercase shadow-lg transition-all"
                            >
                                <i className="fas fa-sign-out-alt"></i>
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {!emailVerified && user && (
                <div className="bg-amber-500 text-white p-2 text-center text-[10px] font-black uppercase tracking-widest animate-pulse">
                    Please check your moe email spam folder page
                    <button onClick={resendVerification} className="ml-4 underline hover:text-black">{t('update')}</button>
                </div>
            )}

            <div className="flex flex-1 overflow-hidden relative">
                <div className="fixed right-6 bottom-6 z-[200] flex items-center gap-3">
                    {showSupportChat && !isAdmin && !isKoperasi && (
                        <div className="fixed right-6 bottom-24 w-[85vw] sm:w-80 h-[450px] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 origin-bottom-right" onClick={(e) => e.stopPropagation()}>
                            <div className="bg-[#3498db] p-4 text-white flex justify-between items-center">
                                <div className="font-black uppercase text-xs flex items-center gap-2">
                                    <i className="fas fa-headset"></i>
                                    {t('admin_support')}
                                </div>
                                <button onClick={() => setShowSupportChat(false)} className="hover:rotate-90 transition-transform p-1">
                                    <i className="fas fa-times text-lg"></i>
                                </button>
                            </div>
                            <SupportChatBody userId={user ? user.uid : guestId} userName={user ? user.displayName : 'Guest'} t={t} isGuest={!user} />
                        </div>
                    )}
                    
                    <div className="flex items-center gap-3">
                        {user && !isKoperasi && (
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if(emailVerified) setIsQuickOfferOpen(true);
                                    else alert(t('check_email_verify'));
                                }}
                                className="bg-[#2ecc71] text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-gray-50"
                                title={t('quick_offer')}
                            >
                                <i className="fas fa-plus text-xl sm:text-2xl"></i>
                            </button>
                        )}

                        <div className="relative flex items-center gap-3">
                            <button 
                                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                                className="bg-white text-[#2c3e50] w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-gray-50"
                                title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                            >
                                <i className={`fas fa-${theme === 'light' ? 'moon' : 'sun'} text-xl sm:text-2xl`}></i>
                            </button>

                            <div className="relative">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsLangOpen(!isLangOpen); }}
                                    className="bg-white text-[#2c3e50] w-12 h-12 sm:w-14 sm:h-14 rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-gray-50"
                                >
                                    <i className="fas fa-language text-xl sm:text-2xl"></i>
                                </button>
                                {isLangOpen && (
                                    <div className="absolute bottom-full right-0 mb-3 bg-white shadow-2xl rounded-2xl border border-gray-100 overflow-hidden z-[210] min-w-[140px] animate-in slide-in-from-bottom-2">
                                        {(Object.values(Language) as Language[]).map(l => (
                                            <button 
                                                key={l}
                                                onClick={() => { setLang(l); setIsLangOpen(false); }}
                                                className={`w-full px-5 py-3 text-left text-[10px] font-black uppercase transition-colors hover:bg-gray-50 ${lang === l ? 'text-[#3498db] bg-blue-50' : 'text-gray-500'}`}
                                            >
                                                {l === Language.EN && 'English'}
                                                {l === Language.BM && 'Bahasa Melayu'}
                                                {l === Language.BC && '中文'}
                                                {l === Language.BI && 'Bahasa Iban'}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {user && (
                            isAdmin ? (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowAdminPanel(!showAdminPanel); }}
                                    className="bg-[#2c3e50] text-white w-16 h-16 rounded-full shadow-2xl flex flex-col items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-white z-[201]"
                                >
                                    <i className={`fas fa-${showAdminPanel ? 'times' : 'user-shield'} text-2xl`}></i>
                                    <span className="text-[7px] font-black uppercase mt-1">Admin</span>
                                </button>
                            ) : !isKoperasi && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setShowSupportChat(!showSupportChat); }}
                                    className="bg-[#3498db] text-white w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all border-4 border-white z-[201] outline-none focus:outline-none"
                                >
                                    <i className="fas fa-comment-dots text-3xl"></i>
                                </button>
                            )
                        )}
                    </div>
                </div>

                <main className={`flex-1 overflow-y-auto transition-all duration-300 ${isAdmin && showAdminPanel ? 'lg:mr-80' : ''}`}>
                    <div className="container mx-auto px-4 py-8 max-w-6xl">
                        {page === 'home' && !isKoperasi && <HomePage t={t} user={user} lang={lang} />}
                        {page === 'gallery' && !isKoperasi && <OffersPage t={t} user={user} />}
                        {page === 'profile' && !isKoperasi && <ProfilePage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} onNavigate={() => {}} />}
                        {page === 'shop' && <ShopPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} onRedeemConfirm={setItemToRedeem} sheetInventory={sheetInventory} />}
                        {page === 'history' && !isKoperasi && <HistoryPage user={user} t={t} onAuth={() => setIsAuthModalOpen(true)} />}
                        {page === 'admin' && (isAdmin || isKoperasi) && <div className="bg-white p-8 rounded-[2.5rem] shadow-xl"><AdminPanelContent t={t} user={user} isKoperasiMenu={isKoperasi} onUpdateUser={syncNewUser} /></div>}
                    </div>
                </main>

                {isAdmin && (
                    <aside className={`fixed top-16 sm:top-20 right-4 bottom-[120px] w-72 sm:w-80 bg-white border border-gray-100 rounded-[2.5rem] shadow-2xl z-[100] transition-transform duration-300 transform overflow-hidden ${showAdminPanel ? 'translate-x-0' : 'translate-x-[120%]'}`}>
                        <AdminPanelContent t={t} user={user} onUpdateUser={syncNewUser} />
                    </aside>
                )}
            </div>

            <aside className={`fixed inset-y-0 left-0 w-[80vw] sm:w-80 z-[301] transform transition-transform duration-500 shadow-2xl flex flex-col ${theme === 'dark' ? 'bg-[#0d1930]' : 'bg-white'} ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-8 flex flex-col h-full overflow-y-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-4 mb-12">
                        <h2 className="text-xl font-black italic text-[#2c3e50] uppercase tracking-tighter truncate pr-4">
                            {user?.displayName || t('guest')}
                        </h2>
                        <button onClick={() => setIsMenuOpen(false)} className="text-gray-400 hover:text-red-500 shrink-0 ml-auto">
                            <i className="fas fa-times text-2xl"></i>
                        </button>
                    </div>
                    {user && !isKoperasi && (
                        <div className="mb-8 p-4 bg-gray-50 rounded-2xl shrink-0 kindness-box">
                            <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{t('kindness_level')}</div>
                            <div className="text-2xl font-black text-[#f39c12]">{user.points} <span className="text-xs">{t('points')}</span></div>
                        </div>
                    )}
                    <nav className="flex flex-col gap-2 pb-8">
                        {!isKoperasi ? (
                            <>
                                <MenuItem icon="bullhorn" label={t('home')} onClick={() => { setPage('home'); setIsMenuOpen(false); }} active={page === 'home'} />
                                <MenuItem icon="hand-holding-heart" label={t('offers')} onClick={() => { setPage('gallery'); setIsMenuOpen(false); }} active={page === 'gallery'} />
                                <MenuItem icon="user" label={t('profile')} onClick={() => { setPage('profile'); setIsMenuOpen(false); }} active={page === 'profile'} />
                                <MenuItem icon="shopping-cart" label={t('points_shop')} onClick={() => { setPage('shop'); setIsMenuOpen(false); }} active={page === 'shop'} />
                                <MenuItem icon="history" label={t('history')} onClick={() => { setPage('history'); setIsMenuOpen(false); }} active={page === 'history'} />
                            </>
                        ) : (
                            <>
                                <MenuItem icon="user-shield" label={t('koperasi_panel')} onClick={() => { setPage('admin'); setIsMenuOpen(false); }} active={page === 'admin'} />
                                <MenuItem icon="shopping-cart" label={t('points_shop')} onClick={() => { setPage('shop'); setIsMenuOpen(false); }} active={page === 'shop'} />
                            </>
                        )}
                    </nav>
                </div>
            </aside>
            {isMenuOpen && <div className="fixed inset-0 bg-black/50 z-[300]" onClick={() => setIsMenuOpen(false)}></div>}

            {/* LOGO UPLOAD MODAL (UPGRADED UI) */}
            {isLogoModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-[1200] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => !uploading && setIsLogoModalOpen(false)}>
                    <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-in zoom-in" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-black uppercase italic text-[#2c3e50] mb-2 text-center">Site Branding</h3>
                        <p className="text-[10px] font-bold text-gray-400 text-center uppercase tracking-widest mb-8">Update Logo Identity</p>
                        
                        <div className="space-y-6">
                            <div className="relative group">
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                    id="logo-upload"
                                    disabled={uploading}
                                />
                                <label 
                                    htmlFor="logo-upload" 
                                    className={`w-full flex flex-col items-center justify-center p-12 border-4 border-dashed rounded-[2.5rem] transition-all group ${uploading ? 'bg-gray-50 border-gray-100 cursor-not-allowed' : 'border-gray-100 cursor-pointer hover:border-[#3498db] hover:bg-blue-50/30'}`}
                                >
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-4 transition-transform ${uploading ? 'bg-gray-200 text-gray-400 animate-pulse' : 'bg-blue-50 text-[#3498db] group-hover:scale-110'}`}>
                                        <i className={`fas fa-${uploading ? 'spinner fa-spin' : 'cloud-upload-alt'}`}></i>
                                    </div>
                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">
                                        {uploading ? `${t('uploading')} ${uploadProgress}%` : t('pick_logo')}
                                    </span>
                                </label>
                            </div>

                            {uploading && (
                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                    <div className="bg-[#3498db] h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                                </div>
                            )}

                            {branding.logoUrl && !uploading && (
                                <div className="p-6 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200 flex flex-col items-center">
                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-4">{t('active_logo')}</span>
                                    <div className="w-24 h-24 rounded-2xl bg-white shadow-xl border-4 border-white overflow-hidden p-2">
                                        <Logo customUrl={branding.logoUrl} className="w-full h-full" />
                                    </div>
                                    <button 
                                        onClick={removeLogo}
                                        className="mt-4 text-[9px] font-black text-red-500 uppercase hover:underline"
                                    >
                                        {t('remove_logo')}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 mt-10">
                            <button 
                                onClick={() => setIsLogoModalOpen(false)} 
                                disabled={uploading}
                                className="w-full bg-gray-100 text-gray-500 py-4 rounded-2xl font-black uppercase hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                {t('close')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isNotifOpen && (
                <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4 backdrop-blur-sm notif-overlay" onClick={() => setIsNotifOpen(false)}>
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300 max-h-[80vh] notif-content" onClick={e => e.stopPropagation()}>
                        <div className="p-6 bg-gray-50 border-b flex justify-between items-center notif-header">
                            <h3 className="font-black uppercase text-sm italic text-[#2c3e50] tracking-tighter">{t('activity_logs')}</h3>
                            <button onClick={() => setIsNotifOpen(false)} className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><i className="fas fa-times text-xs"></i></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {notifications.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300"><i className="fas fa-bell-slash text-2xl"></i></div>
                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('nothing_here')}</p>
                                </div>
                            ) : (
                                notifications.map(n => (
                                    <div key={n.id} onClick={() => markNotifRead(n)} className={`p-5 rounded-3xl border transition-all ${!n.read ? 'bg-blue-50/50 border-blue-100 ring-1 ring-blue-100' : 'bg-white border-gray-100'}`}>
                                        <div className="flex gap-4">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-[14px] shrink-0 shadow-sm ${n.type === 'offer' ? 'bg-green-500' : n.type === 'message' ? 'bg-blue-500' : 'bg-[#f39c12]'}`}>
                                                <i className={`fas fa-${n.type === 'offer' ? 'hand-holding-heart' : n.type === 'message' ? 'comment' : 'star'}`}></i>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-[11px] font-black text-gray-800 uppercase tracking-tighter">
                                                  {n.type === 'offer' ? t('new_offer_notif') : n.type === 'message' ? t('support_msg_notif') : t('points_earned_notif')}
                                                </p>
                                                <p className="text-[10px] text-gray-500 font-medium">{n.message}</p>
                                                <div className="mt-2 text-[8px] font-black text-gray-400 uppercase">
                                                  {n.createdAt?.toDate?.() ? n.createdAt.toDate().toLocaleString() : t('recent')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {isAuthModalOpen && <AuthModal onClose={() => setIsAuthModalOpen(false)} t={t} lang={lang} onRegisterSuccess={syncNewUser} theme={theme} />}
            
            {isQuickOfferOpen && user && !isKoperasi && (
                <div className="fixed inset-0 bg-black/80 z-[600] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsQuickOfferOpen(false)}>
                    <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in zoom-in relative" onClick={e => e.stopPropagation()}>
                         <button onClick={() => setIsQuickOfferOpen(false)} className="absolute top-6 right-6 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-red-500 hover:text-white transition-all z-10">
                            <i className="fas fa-times"></i>
                         </button>
                         <QuickOfferModalContent user={user} t={t} onComplete={() => setIsQuickOfferOpen(false)} />
                    </div>
                </div>
            )}

            {redeemSuccessCode && (
                <div className="fixed inset-0 bg-black/80 z-[1100] flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-in zoom-in text-center relative">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">
                            <i className="fas fa-check"></i>
                        </div>
                        <h3 className="text-2xl font-black uppercase italic text-[#2c3e50] mb-2">{t('redeem_success_msg')}</h3>
                        <div className="bg-[#2c3e50] text-[#f39c12] text-4xl font-black p-6 rounded-3xl mb-6 tracking-widest shadow-xl">
                            {redeemSuccessCode}
                        </div>
                        <p className="text-gray-500 font-bold text-sm leading-relaxed mb-8">
                            {t('redeem_remember_code')}
                        </p>
                        <button 
                            onClick={() => {
                                setRedeemSuccessCode(null);
                                setPage('history');
                            }} 
                            className="w-full bg-[#3498db] text-white py-5 rounded-2xl font-black uppercase shadow-lg active:scale-95"
                        >
                            {t('confirm')}
                        </button>
                    </div>
                </div>
            )}

            {itemToRedeem && (
                <RedeemConfirmModal 
                    item={itemToRedeem} user={user!} t={t} onCancel={() => setItemToRedeem(null)} 
                    sheetInventory={sheetInventory}
                    onConfirm={async (fullName, userClass, selectedItemName) => {
                        if (typeof firebase === 'undefined' || !firebase.firestore) return;
                        const db = firebase.firestore();
                        try {
                            const userRef = db.collection('users').doc(user!.uid);
                            const counterRef = db.collection('counters').doc('redemptions');
                            
                            // Use the selected item name from the modal's dropdown
                            const finalItemName = selectedItemName || itemToRedeem.name;
                            const finalItemCost = itemToRedeem.name === finalItemName ? itemToRedeem.cost : 0; // Default cost 0 for sheet items

                            let rdCode = '';
                            await db.runTransaction(async (transaction: any) => {
                                const userDoc = await transaction.get(userRef);
                                if (userDoc.data().points < finalItemCost) throw new Error("Not enough points");
                                
                                // Monthly Point Limit Check (200 pts)
                                const now = new Date();
                                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                                const firstDayTimestamp = firebase.firestore.Timestamp.fromDate(firstDay);

                                // Get ALL user's redemptions and filter client-side
                                const allHistorySnap = await db.collection('redeem_history')
                                    .where('userId', '==', user!.uid)
                                    .get();

                                let monthlyTotal = 0;
                                allHistorySnap.forEach((d: any) => {
                                    const data = d.data();
                                    const redeemedAt = data.redeemedAt;
                                    // Check if redeemed this month (client-side filter)
                                    if (redeemedAt && redeemedAt.seconds >= firstDayTimestamp.seconds) {
                                        monthlyTotal += (data.itemPoints || 0);
                                    }
                                });

                                if (monthlyTotal + finalItemCost > 200) {
                                    throw new Error(t('points_limit_msg'));
                                }

                                const counterDoc = await transaction.get(counterRef);
                                let currentCount = 1;
                                if (counterDoc.exists) {
                                    currentCount = (counterDoc.data().count || 0) + 1;
                                }
                                transaction.set(counterRef, { count: currentCount }, { merge: true });
                                
                                rdCode = `RD-${String(currentCount).padStart(4, '0')}`;
                                
                                transaction.update(userRef, { points: userDoc.data().points - finalItemCost });
                                transaction.set(db.collection('redeem_history').doc(), {
                                    userId: user!.uid, 
                                    fullName, 
                                    userClass, 
                                    itemName: finalItemName, 
                                    itemPoints: finalItemCost, 
                                    rdCode: rdCode,
                                    redeemedAt: firebase.firestore.FieldValue.serverTimestamp(),
                                    status: 'confirmed'
                                });
                            });
                            
                            // Send notification immediately since it's direct confirmed
                            await db.collection('notifications').add({
                                userId: user!.uid,
                                title: "Redeem Confirmed",
                                message: `Your redeem for ${finalItemName} has been confirmed. Code: ${rdCode}`,
                                type: 'status',
                                read: false,
                                createdAt: firebase.firestore.FieldValue.serverTimestamp()
                            });
                            
                            // Log to Google Sheets after successful Firebase update
                            await syncRedemption(user, finalItemName);

                            setItemToRedeem(null);
                            setRedeemSuccessCode(rdCode);
                        } catch (e: any) { alert(e.message); }
                    }} 
                />
            )}
        </div>
    );
};

const AuthModal: React.FC<{onClose: () => void, t: any, lang: Language, onRegisterSuccess: (data: any) => void, theme: 'light' | 'dark'}> = ({onClose, t, lang, onRegisterSuccess, theme}) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [data, setData] = useState({ email: '', password: '', name: '', birthdate: '', phone: '', address: '', userClass: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    const submit = async (dataInput: any, currentMode: 'login' | 'register', e: React.FormEvent) => {
        e.preventDefault();
        if (typeof firebase === 'undefined' || !firebase.auth) return;
        setLoading(true); setError(null);
        try {
            if (currentMode === 'login') {
                const { user } = await firebase.auth().signInWithEmailAndPassword(dataInput.email, dataInput.password);
                const isHardcodedAdmin = dataInput.email === 'admin@gmail.com';
                const isKoperasi = dataInput.email === 'koperasi@gmail.com';
                
                if (!user.emailVerified && !isHardcodedAdmin && !isKoperasi) {
                    await user.sendEmailVerification();
                    await firebase.auth().signOut();
                    throw new Error("Verification email sent! Please check your moe email spam folder page.");
                }
                onClose();
            } else if (currentMode === 'register') {
                if (!dataInput.email.toLowerCase().endsWith("@moe-dl.edu.my") && dataInput.email !== 'admin@gmail.com' && dataInput.email !== 'koperasi@gmail.com') {
                    throw new Error(t('moe_email_required'));
                }
                const {user} = await firebase.auth().createUserWithEmailAndPassword(dataInput.email, dataInput.password);
                
                if (user) {
                    await user.sendEmailVerification();
                    const userData = { 
                        email: dataInput.email, displayName: dataInput.name, points: 5, birthdate: dataInput.birthdate, 
                        phone: dataInput.phone, address: dataInput.address, userClass: dataInput.userClass, 
                        isAdmin: dataInput.email === 'admin@gmail.com',
                        isKoperasi: dataInput.email === 'koperasi@gmail.com',
                        password: dataInput.password 
                    };
                    await firebase.firestore().collection('users').doc(user.uid).set(userData);
                    await onRegisterSuccess(userData);
                    await firebase.auth().signOut();
                    alert("Verification message sent, please check your moe email spam folder page");
                    setMode('login');
                }
            }
        } catch (err: any) { setError(err.message); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm bg-black/40" onClick={onClose}>
            <style>{`
                .auth-modal-card {
                    width: 100%;
                    max-width: 450px;
                    background: ${theme === 'dark' ? 'radial-gradient(circle at 50% 50%, #1b2735 0%, #090a0f 100%)' : 'white'};
                    border-radius: 2.5rem;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.2);
                    overflow: hidden;
                    border: 4px solid #3498db;
                    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .auth-tab-btn {
                    flex: 1;
                    padding: 1.25rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    font-style: italic;
                    font-size: 0.75rem;
                    letter-spacing: 0.1em;
                    transition: all 0.3s ease;
                    background: ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8f9fa'};
                    color: ${theme === 'dark' ? '#f8f9fa' : '#3498db'};
                }
                .auth-tab-btn.active {
                    background: #3498db;
                    color: white;
                }
                .auth-tab-btn:not(.active):hover {
                    background: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#ebf5fb'};
                }
                .bright-input {
                    background: ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#f8f9fa'};
                    border: 2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#ebf5fb'};
                    color: ${theme === 'dark' ? 'white' : '#2c3e50'};
                    transition: all 0.3s ease;
                }
                .bright-input:focus {
                    border-color: #3498db;
                    background: ${theme === 'dark' ? 'rgba(255,255,255,0.15)' : 'white'};
                    box-shadow: 0 0 0 4px rgba(52, 152, 219, 0.1);
                }
            `}</style>

            <div className="auth-modal-card relative z-10 animate-in zoom-in duration-300 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header with Tabs - Fixed at top */}
                <div className={`relative border-b-4 border-[#3498db] z-30 shrink-0 ${theme === 'dark' ? 'bg-[#1b2735]' : 'bg-white'} flex items-center`}>
                    <div className="flex flex-1">
                        <button 
                            onClick={() => { setMode('login'); setError(null); }}
                            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
                        >
                            <i className="fas fa-sign-in-alt mr-2"></i>
                            {t('login')}
                        </button>
                        <button 
                            onClick={() => { setMode('register'); setError(null); }}
                            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
                        >
                            <i className="fas fa-user-plus mr-2"></i>
                            {t('register')}
                        </button>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-4 sm:p-5 text-[#3498db] hover:bg-red-500 hover:text-white transition-all border-l-2 border-[#3498db]/20 flex-shrink-0"
                        title="Close"
                    >
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>

                {/* Scrollable Content Area */}
                <div className="p-8 overflow-y-auto custom-scrollbar">
                    <div className="mb-8 text-center">
                        <h2 className="text-2xl font-black uppercase italic text-[#2c3e50] tracking-tighter">
                            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p className="text-[10px] font-bold text-[#3498db] uppercase tracking-[0.3em] mt-1">
                            {mode === 'login' ? 'Access your dashboard' : 'Join our community'}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 bg-red-50 border-2 border-red-100 p-4 rounded-2xl text-red-500 text-[10px] font-black uppercase tracking-wider text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={(e) => submit(data, mode, e)} className="space-y-4">
                        {mode === 'register' && (
                            <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">{t('full_name')}</label>
                                        <input placeholder="Name" value={data.name} onChange={e => setData({...data, name: e.target.value})} className="w-full bright-input p-4 rounded-2xl outline-none font-bold text-sm" required />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">{t('class_label')}</label>
                                        <input placeholder="Class" value={data.userClass} onChange={e => setData({...data, userClass: e.target.value})} className="w-full bright-input p-4 rounded-2xl outline-none font-bold text-sm" required />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Birthdate</label>
                                        <input type="date" value={data.birthdate} onChange={e => setData({...data, birthdate: e.target.value})} className="w-full bright-input p-4 rounded-2xl outline-none font-bold text-sm" required />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">Phone</label>
                                        <input type="tel" placeholder="Phone" value={data.phone} onChange={e => setData({...data, phone: e.target.value})} className="w-full bright-input p-4 rounded-2xl outline-none font-bold text-sm" required />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">{t('home_address')}</label>
                                    <input placeholder="Address" value={data.address} onChange={e => setData({...data, address: e.target.value})} className="w-full bright-input p-4 rounded-2xl outline-none font-bold text-sm" required />
                                </div>
                            </>
                        )}

                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">MOE Email</label>
                            <input 
                                type="email" 
                                placeholder="m-xxxxxxxx@moe-dl.edu.my" 
                                value={data.email} 
                                onChange={e => setData({...data, email: e.target.value})} 
                                className="w-full bright-input p-4 rounded-2xl outline-none font-bold text-sm" 
                                required 
                            />
                        </div>
                        
                        <div className="space-y-1">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-2">{t('password')}</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    placeholder="••••••••" 
                                    value={data.password} 
                                    onChange={e => setData({...data, password: e.target.value})} 
                                    className="w-full bright-input p-4 rounded-2xl outline-none font-bold text-sm" 
                                    required 
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 hover:text-[#3498db]">
                                    <i className={`fas fa-${showPassword ? 'eye-slash' : 'eye'}`}></i>
                                </button>
                            </div>
                        </div>
                        
                        <button 
                            disabled={loading} 
                            className="w-full bg-[#3498db] text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all mt-6 uppercase tracking-widest disabled:opacity-50"
                        >
                            {loading ? <i className="fas fa-spinner fa-spin"></i> : (mode === 'login' ? t('login') : t('register'))}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const ProfilePage: React.FC<{user: any | null, t: any, onAuth: () => void, onNavigate: (p: string) => void}> = ({user, t, onAuth}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState<any>(null);
    const [saving, setSaving] = useState(false);

    const isAdmin = user?.isAdmin || user?.email === 'admin@gmail.com';

    useEffect(() => {
        if (user) {
            setEditData({
                displayName: user.displayName || '',
                userClass: user.userClass || '',
                phone: user.phone || '',
                birthdate: user.birthdate || '',
                address: user.address || ''
            });
        }
    }, [user, isEditing]);

    if (!user) return <div className="py-20 text-center"><button onClick={onAuth} className="bg-[#3498db] text-white px-8 py-4 rounded-2xl font-black uppercase shadow-xl">{t('login')}</button></div>;

    const handleSave = async () => {
        if (!editData || !user || typeof firebase === 'undefined' || !firebase.firestore) return;
        setSaving(true);
        try {
            const updatePayload = {
                displayName: editData.displayName,
                userClass: editData.userClass,
                phone: editData.phone,
                birthdate: editData.birthdate,
                address: editData.address
            };
            await firebase.firestore().collection('users').doc(user.uid).update(updatePayload);
            setIsEditing(false);
            alert(t('save') + "!");
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (isAdmin) return;
        if (window.confirm(t('delete_confirm'))) {
            if (window.confirm("FINAL WARNING: All points and data will be lost. Proceed?")) {
                try {
                    const currentUser = firebase.auth().currentUser;
                    const uid = currentUser.uid;
                    await firebase.firestore().collection('users').doc(uid).delete();
                    await currentUser.delete();
                    alert("Account deleted.");
                } catch (err: any) {
                    alert("Authentication required. Please logout and login again before deleting your account.");
                }
            }
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-20">
            <div className="bg-[#2c3e50] p-12 rounded-[2rem] shadow-xl text-white text-center border-b-8 border-[#f39c12] relative overflow-hidden">
                <div className="w-20 h-20 bg-[#3498db] rounded-full flex items-center justify-center text-3xl font-black mx-auto mb-6 uppercase border-4 border-white/20 shadow-inner">
                    {user.displayName?.[0] || '?'}
                </div>
                {isEditing ? (
                    <div className="space-y-4 max-w-xs mx-auto">
                        <input 
                            value={editData.displayName} 
                            onChange={e => setEditData({...editData, displayName: e.target.value})}
                            placeholder={t('full_name')}
                            className="w-full bg-white/10 border-2 border-white/20 rounded-xl p-3 text-white font-black uppercase text-center placeholder:text-white/40 outline-none focus:border-[#3498db] transition-all"
                        />
                        <input 
                            value={editData.userClass} 
                            onChange={e => setEditData({...editData, userClass: e.target.value})}
                            placeholder={t('class_label')}
                            className="w-full bg-white/10 border-2 border-white/20 rounded-xl p-3 text-white font-black uppercase text-center placeholder:text-white/40 outline-none focus:border-[#3498db] transition-all"
                        />
                    </div>
                ) : (
                    <>
                        <h1 className="text-2xl font-black uppercase italic mb-2 tracking-tighter">{user.displayName || 'Guest'}</h1>
                        <p className="text-[#f39c12] font-black text-xl flex items-center justify-center gap-2">
                            <i className="fas fa-star"></i> {user.points} {t('points')}
                        </p>
                        {user.userClass && <p className="text-xs font-bold uppercase tracking-widest text-white/60 mt-2">{user.userClass}</p>}
                    </>
                )}
                
                <button 
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)} 
                    disabled={saving}
                    className="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all border border-white/10 group"
                >
                    <i className={`fas fa-${isEditing ? (saving ? 'spinner fa-spin' : 'check') : 'pen'} text-xs text-white`}></i>
                </button>
                {isEditing && (
                    <button 
                        onClick={() => setIsEditing(false)} 
                        className="absolute top-6 left-6 w-12 h-12 bg-red-500/20 hover:bg-red-500/40 rounded-full flex items-center justify-center transition-all border border-red-500/20"
                    >
                        <i className="fas fa-times text-xs text-white"></i>
                    </button>
                )}
            </div>

            <div className="bg-white p-8 rounded-[2rem] border shadow-sm space-y-6 relative group border-gray-100">
                <h3 className="text-[10px] font-black uppercase text-gray-400 tracking-widest border-b border-gray-50 pb-3">{t('personal_info')}</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('phone_number')}</label>
                        {isEditing ? (
                            <input 
                                value={editData.phone} 
                                onChange={e => setEditData({...editData, phone: e.target.value})}
                                className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-xs outline-none focus:border-[#3498db]"
                            />
                        ) : (
                            <p className="font-bold text-[#2c3e50] bg-gray-50/50 p-3 rounded-xl border border-transparent">{user.phone || t('not_set')}</p>
                        )}
                    </div>
                    
                    <div className="space-y-1">
                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest ml-1">{t('birthdate')}</label>
                        {isEditing ? (
                            <input 
                                type="date"
                                value={editData.birthdate} 
                                onChange={e => setEditData({...editData, birthdate: e.target.value})}
                                className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-xs outline-none focus:border-[#3498db]"
                            />
                        ) : (
                            <p className="font-bold text-[#2c3e50] bg-gray-50/50 p-3 rounded-xl border border-transparent">{user.birthdate || t('not_set')}</p>
                        )}
                    </div>

                    <div className="col-span-1 sm:col-span-2 space-y-1">
                        <label className="text-[8px] font-black uppercase text-gray-400 tracking-widest ml-1">{t('home_address')}</label>
                        {isEditing ? (
                            <textarea 
                                value={editData.address} 
                                onChange={e => setEditData({...editData, address: e.target.value})}
                                className="w-full p-3 bg-gray-50 border-2 border-gray-100 rounded-xl font-bold text-xs outline-none focus:border-[#3498db] min-h-[80px]"
                            />
                        ) : (
                            <p className="font-bold text-[#2c3e50] bg-gray-50/50 p-3 rounded-xl border border-transparent">{user.address || t('not_set')}</p>
                        )}
                    </div>
                </div>

                <div className="pt-6 space-y-4">
                    {isEditing ? (
                        <button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="w-full bg-[#3498db] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-blue-100 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                        >
                            {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                            {t('save_profile')}
                        </button>
                    ) : (
                        <>
                            <button onClick={() => firebase.auth().signOut()} className="w-full bg-[#2c3e50] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2">
                                <i className="fas fa-sign-out-alt"></i>
                                {t('logout')}
                            </button>
                            {!isAdmin && (
                                <button onClick={handleDeleteAccount} className="w-full border-2 border-red-100 text-red-500 py-4 rounded-2xl font-black uppercase text-[10px] transition-all hover:bg-red-50 flex items-center justify-center gap-2">
                                    <i className="fas fa-trash"></i>
                                    {t('delete_account')}
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ShopPage: React.FC<{user: any, t: any, onAuth: () => void, onRedeemConfirm: (item: any) => void, sheetInventory: string[]}> = ({user, t, onAuth, onRedeemConfirm, sheetInventory}) => {
    const [rewards, setRewards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);
    const [newItem, setNewItem] = useState({ name: '', cost: 0, color: '#3498db' });

    useEffect(() => {
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        const unsub = db.collection('shop_items').onSnapshot((snap: any) => {
            const data = snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
            data.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            setRewards(data);
            setLoading(false);
        }, (err: any) => {
            setLoading(false);
        });
        return unsub;
    }, []);

    const isAdmin = user?.isAdmin || user?.email === 'admin@gmail.com';
    const dayOfMonth = new Date().getDate();
    const isShopOpen = dayOfMonth <= 21;

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        if (editingItem) {
            await db.collection('shop_items').doc(editingItem.id).update(newItem);
            setEditingItem(null);
        } else {
            await db.collection('shop_items').add({
                ...newItem,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        setNewItem({ name: '', cost: 0, color: '#3498db' });
        setShowAddForm(false);
    };

    const handleDeleteItem = async (id: string) => {
        if (!id) return;
        if (window.confirm("Delete this reward?")) {
            await firebase.firestore().collection('shop_items').doc(id).delete();
        }
    };

    if (loading) return <div className="text-center py-20 font-black uppercase text-gray-300">Checking Inventory...</div>;

    if (!isShopOpen && !isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-gray-100 px-8 text-center animate-in fade-in zoom-in duration-500 shop-page-container">
                <div className="w-24 h-24 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-4xl mb-6">
                    <i className="fas fa-lock"></i>
                </div>
                <h2 className="text-3xl font-black text-[#2c3e50] uppercase italic tracking-tighter mb-4 leading-tight">
                    {t('shop_closed_msg')}
                </h2>
                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest max-w-md">
                    Reopens 1st day of next month.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 shop-page-container">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-black italic uppercase text-[#2c3e50] tracking-tighter shrink-0">{t('points_shop')}</h2>
                    {isShopOpen && (
                        <div className="hidden lg:block bg-blue-50 border border-blue-100 p-3 rounded-2xl">
                            <p className="text-[9px] font-bold text-blue-600 leading-tight uppercase">
                                <i className="fas fa-info-circle mr-2"></i>
                                {t('shop_open_warning')}
                            </p>
                        </div>
                    )}
                </div>
                {isAdmin && (
                    <button onClick={() => { setShowAddForm(true); setEditingItem(null); setNewItem({name: '', cost: 0, color: '#3498db'}); }} className="bg-[#2c3e50] text-white px-6 py-2 rounded-full font-black text-[10px] uppercase shadow-lg transition-all active:scale-95 shrink-0">
                        <i className="fas fa-plus mr-2"></i>
                        {t('add_reward')}
                    </button>
                )}
            </div>

            {isShopOpen && (
                <div className="lg:hidden bg-blue-50 border border-blue-100 p-5 rounded-3xl mb-4">
                    <p className="text-[10px] font-bold text-blue-600 leading-relaxed uppercase">
                        <i className="fas fa-info-circle mr-2"></i>
                        {t('shop_open_warning')}
                    </p>
                </div>
            )}

            {showAddForm && (
                <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-4 backdrop-blur-sm">
                    <form onSubmit={handleAddItem} className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-xl w-full space-y-4 animate-in zoom-in">
                        <h3 className="text-xl font-black uppercase italic mb-4">{editingItem ? 'Edit Reward' : t('add_reward')}</h3>
                        <AdminInput label={t('product_name')} value={newItem.name} onChange={v => setNewItem({...newItem, name: v})} placeholder="e.g. Special Voucher" />
                        <AdminInput label={t('point_cost')} type="number" value={newItem.cost} onChange={v => setNewItem({...newItem, cost: v})} />
                        <AdminInput label={t('color_code')} type="color" value={newItem.color} onChange={v => setNewItem({...newItem, color: v})} />
                        <div className="flex gap-4 pt-4">
                            <button type="submit" className="flex-1 bg-[#3498db] text-white py-4 rounded-2xl font-black uppercase shadow-xl">{editingItem ? t('save') : t('confirm')}</button>
                            <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black uppercase">{t('cancel')}</button>
                        </div>
                    </form>
                </div>
            )}

            {rewards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-gray-100">
                    <i className="fas fa-rocket text-6xl text-gray-200 mb-6 animate-bounce"></i>
                    <h2 className="text-4xl font-black text-[#2c3e50] uppercase italic tracking-tighter">Coming Soon</h2>
                    <p className="text-gray-400 font-bold uppercase text-xs mt-2">Our store is currently being restocked with kindness rewards.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    {rewards.map(item => (
                        <div key={item.id} className="bg-white p-8 rounded-[2.5rem] shadow-lg border-b-8 transition-transform hover:-translate-y-2 relative group" style={{ borderColor: item.color || '#3498db' }}>
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl mb-6 shadow-lg" style={{ backgroundColor: item.color || '#3498db' }}>
                                <i className="fas fa-gift"></i>
                            </div>
                            <h3 className="text-xl font-black text-[#2c3e50] uppercase mb-2">{item.name}</h3>
                            <p className="text-[#f39c12] font-black text-lg mb-6">{item.cost} <span className="text-xs uppercase">{t('points')}</span></p>
                            
                            <div className="space-y-3">
                                <button 
                                    onClick={() => user ? onRedeemConfirm(item) : onAuth()}
                                    className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg transition-all active:scale-95 text-white"
                                    style={{ backgroundColor: item.color || '#3498db' }}
                                >
                                    {t('redeem_now')}
                                </button>
                                
                                {isAdmin && (
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => { setEditingItem(item); setNewItem({name: item.name, cost: item.cost, color: item.color}); setShowAddForm(true); }} 
                                            className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-black uppercase text-[10px] hover:bg-gray-200 transition-colors"
                                        >
                                            <i className="fas fa-edit mr-1"></i> Edit
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteItem(item.id)} 
                                            className="flex-1 bg-red-50 text-red-500 py-3 rounded-xl font-black uppercase text-[10px] hover:bg-red-100 transition-colors"
                                        >
                                            <i className="fas fa-trash mr-1"></i> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const HistoryPage: React.FC<{user: any, t: any, onAuth: () => void}> = ({user, t, onAuth}) => {
    const [redeems, setRedeems] = useState<any[]>([]);
    const [myOffers, setMyOffers] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'offers' | 'rewards'>('offers');
    const [editingOffer, setEditingOffer] = useState<any>(null);
    
    useEffect(() => {
        if (!user || typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        
        const unsubRedeems = db.collection('redeem_history')
            .where('userId', '==', user.uid)
            .onSnapshot((snap: any) => {
                const data = snap.docs.map((d: any) => ({...d.data(), id: d.id}));
                data.sort((a: any, b: any) => (b.redeemedAt?.toMillis?.() || 0) - (a.redeemedAt?.toMillis?.() || 0));
                setRedeems(data);
            });

        const unsubOffers = db.collection('donations')
            .where('userId', '==', user.uid)
            .onSnapshot((snap: any) => {
                const data = snap.docs.map((d: any) => ({...d.data(), id: d.id, active: true}));
                db.collection('completed_donations').where('userId', '==', user.uid).get().then((cSnap: any) => {
                    const cData = cSnap.docs.map((d: any) => ({...d.data(), id: d.id, active: false}));
                    const combined = [...data, ...cData];
                    combined.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                    setMyOffers(combined);
                });
            });

        return () => { unsubRedeems(); unsubOffers(); };
    }, [user]);

    const handleDeleteOffer = async (offer: any) => {
        if (!window.confirm("Delete this offer? This cannot be undone.")) return;
        const db = firebase.firestore();
        const collection = offer.active ? 'donations' : 'completed_donations';
        await db.collection(collection).doc(offer.id).delete();
        alert("Deleted successfully.");
    };

    const handleUpdateOffer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (typeof firebase === 'undefined' || !firebase.firestore) return;

        // Strict 1-month check for Food category on edit
        if (editingOffer.category === 'category_food' && editingOffer.expiryDate) {
            const now = new Date();
            const expiry = new Date(editingOffer.expiryDate);
            const oneMonthLater = new Date();
            oneMonthLater.setMonth(now.getMonth() + 1);

            if (expiry < oneMonthLater) {
                alert("your offer had been rejected since the expired date of the food is less than 1 month");
                return;
            }
        }

        const db = firebase.firestore();
        await db.collection('donations').doc(editingOffer.id).update({
            itemName: editingOffer.itemName,
            category: editingOffer.category,
            qty: Number(editingOffer.qty),
            expiryDate: editingOffer.category === 'category_food' ? (editingOffer.expiryDate || null) : null
        });
        setEditingOffer(null);
        alert("Updated successfully.");
    };

    if (!user) return <div className="py-20 text-center"><button onClick={onAuth} className="bg-[#3498db] text-white px-8 py-4 rounded-2xl font-black uppercase shadow-xl">{t('login')}</button></div>;
    
    return (
        <div className="space-y-8 history-page-container">
            <h2 className="text-3xl font-black italic uppercase text-[#2c3e50] tracking-tighter">{t('history')}</h2>
            
            <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl max-w-md">
                <button onClick={() => setActiveTab('offers')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${activeTab === 'offers' ? 'bg-white text-[#2c3e50] shadow-sm' : 'text-gray-400'}`}>{t('contributions')}</button>
                <button onClick={() => setActiveTab('rewards')} className={`flex-1 py-3 rounded-xl font-black uppercase text-[10px] transition-all ${activeTab === 'rewards' ? 'bg-white text-[#2c3e50] shadow-sm' : 'text-gray-400'}`}>{t('rewards')}</button>
            </div>

            <div className="space-y-4">
                {activeTab === 'offers' ? (
                    <>
                        {editingOffer && (
                            <div className="fixed inset-0 bg-black/80 z-[800] flex items-center justify-center p-4 backdrop-blur-md">
                                <form onSubmit={handleUpdateOffer} className="bg-white w-full max-md p-8 rounded-[2.5rem] shadow-2xl space-y-4 animate-in zoom-in">
                                    <h3 className="text-xl font-black uppercase italic mb-4">Edit Offer</h3>
                                    <AdminInput label="Item Name" value={editingOffer.itemName} onChange={v => setEditingOffer({...editingOffer, itemName: v})} />
                                    <div className="space-y-2">
                                        <label className="text-[8px] font-black uppercase text-gray-400 tracking-[0.2em] ml-1">{t('status')}</label>
                                        <select 
                                            value={editingOffer.category} 
                                            onChange={e => setEditingOffer({...editingOffer, category: e.target.value})} 
                                            className="w-full p-3 bg-white border-2 border-gray-100 rounded-xl font-bold transition-all text-sm outline-none focus:border-[#3498db] text-[#2c3e50]"
                                        >
                                            <option value="category_food">{t('category_food')}</option>
                                            <option value="category_books">{t('category_books')}</option>
                                            <option value="category_furniture">{t('category_furniture')}</option>
                                            <option value="category_toiletries">{t('category_toiletries')}</option>
                                            <option value="category_others">{t('category_others')}</option>
                                        </select>
                                    </div>
                                    {editingOffer.category === 'category_food' && (
                                        <AdminInput label="Expiry Date" type="date" value={editingOffer.expiryDate || ''} onChange={v => setEditingOffer({...editingOffer, expiryDate: v})} min={new Date().toISOString().split('T')[0]} />
                                    )}
                                    <AdminInput label="Qty" type="number" value={editingOffer.qty} onChange={v => setEditingOffer({...editingOffer, qty: v})} />
                                    <div className="flex gap-2 pt-4">
                                        <button type="submit" className="flex-1 bg-[#3498db] text-white py-3 rounded-xl font-black uppercase text-xs">Save</button>
                                        <button type="button" onClick={() => setEditingOffer(null)} className="flex-1 bg-gray-100 text-gray-400 py-3 rounded-xl font-black uppercase text-xs">Cancel</button>
                                    </div>
                                </form>
                            </div>
                        )}
                        {myOffers.length === 0 ? (
                            <EmptyHistory t={t} />
                        ) : (
                            myOffers.map(o => {
                                const displayCategory = o.category?.startsWith('category_') ? t(o.category) : o.category;
                                return (
                                    <div key={o.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-4 animate-in slide-in-from-bottom-2">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="font-black text-[#2c3e50] uppercase italic">{o.itemName}</h4>
                                                <p className="text-[10px] text-gray-400 font-bold uppercase">{displayCategory} • Qty: {o.qty}</p>
                                                {o.expiryDate && <p className="text-[9px] font-black text-red-500 uppercase">Exp: {o.expiryDate}</p>}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full ${o.active ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                                                    {o.active ? t('pending_approval') : t('verified')}
                                                </span>
                                                {!o.active && <span className="font-black text-green-500 text-[10px]">+{o.earnedPoints || 0} {t('points')}</span>}
                                            </div>
                                        </div>
                                        {o.active ? (
                                            <div className="flex gap-4 pt-2 border-t border-gray-50">
                                                <button onClick={() => setEditingOffer(o)} className="text-[9px] font-black uppercase text-[#3498db] hover:underline flex items-center gap-1">
                                                    <i className="fas fa-edit"></i> Edit
                                                </button>
                                                <button onClick={() => handleDeleteOffer(o)} className="text-[9px] font-black uppercase text-red-500 hover:underline flex items-center gap-1">
                                                    <i className="fas fa-trash"></i> Delete
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="pt-2 border-t border-gray-50 flex justify-end">
                                                 <div className="flex items-center bg-green-50 text-green-600 px-3 py-1 rounded-full text-[9px] font-black gap-2">
                                                     <i className="fas fa-check-double"></i>
                                                     {t('verified_completed')}
                                                 </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </>
                ) : (
                    redeems.length === 0 ? (
                        <EmptyHistory t={t} />
                    ) : (
                        redeems.map(r => (
                            <div key={r.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center animate-in slide-in-from-bottom-2">
                                <div className="flex gap-4 items-center">
                                    <div className="w-12 h-12 bg-blue-50 text-[#3498db] rounded-2xl flex items-center justify-center font-black text-[10px] shrink-0 border border-blue-100">
                                        {r.rdCode || 'N/A'}
                                    </div>
                                    <div>
                                        <h4 className="font-black text-[#2c3e50] uppercase italic">{r.itemName}</h4>
                                        <p className="text-[10px] text-gray-400 font-bold">{r.redeemedAt?.toDate()?.toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`text-[8px] font-black uppercase px-3 py-1 rounded-full ${r.status === 'confirmed' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                        {r.status || 'pending'}
                                    </span>
                                    <span className="font-black text-red-500">-{r.itemPoints} {t('points')}</span>
                                </div>
                            </div>
                        ))
                    )
                )}
            </div>
        </div>
    );
};

const EmptyHistory: React.FC<{t: any}> = ({t}) => (
    <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-gray-100 text-center py-24">
        <i className="fas fa-history text-5xl text-gray-200 mb-6"></i>
        <p className="text-gray-400 font-black uppercase italic text-xs tracking-widest">{t('nothing_here')}</p>
    </div>
);

const RedeemConfirmModal: React.FC<{item: any, user: any, t: any, onCancel: () => void, onConfirm: (name: string, cls: string, selectedItem: string) => void, sheetInventory: string[]}> = ({item, user, t, onCancel, onConfirm, sheetInventory}) => {
    const [name, setName] = useState(user.displayName || '');
    const [cls, setCls] = useState(user.userClass || '');
    const [selectedItem, setSelectedItem] = useState(item?.name || '');

    return (
        <div className="fixed inset-0 bg-black/80 z-[700] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-white w-full max-w-md rounded-[3rem] p-10 shadow-2xl animate-in zoom-in">
                <h3 className="text-2xl font-black uppercase italic text-[#2c3e50] mb-6">{t('confirm')} {selectedItem || item.name}?</h3>
                <div className="space-y-4 mb-8">
                    <AdminInput label={t('full_name')} value={name} onChange={setName} />
                    <AdminInput label={t('class_label')} value={cls} onChange={setCls} />
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{t('select_item_to_redeem')}</label>
                        <select 
                            className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl font-bold text-sm outline-none focus:border-[#3498db] transition-all"
                            onChange={(e) => setSelectedItem(e.target.value)}
                            value={selectedItem || ""}
                        >
                            <option value="">{t('choose_available_item')}</option>
                            {sheetInventory.map((item, index) => (
                                <option key={index} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <p className="text-[10px] font-black text-amber-600 uppercase italic mb-4 text-center bg-amber-50 p-3 rounded-xl border border-amber-100">
                    {t('redeem_wait_msg')}
                </p>

                <div className="flex gap-4">
                    <button onClick={() => onConfirm(name, cls, selectedItem)} className="flex-1 bg-[#2ecc71] text-white py-4 rounded-2xl font-black uppercase shadow-lg active:scale-95">{t('confirm')}</button>
                    <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-500 py-4 rounded-2xl font-black uppercase active:scale-95">{t('cancel')}</button>
                </div>
            </div>
        </div>
    );
};

const AdminChatLogWindow: React.FC<{userId: string}> = ({userId}) => {
    const [logs, setLogs] = useState<any[]>([]);
    useEffect(() => {
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        return firebase.firestore().collection('support_chats')
            .where('userId', '==', userId)
            .onSnapshot((snap: any) => {
                const data = snap.docs.map((d: any) => d.data());
                data.sort((a: any, b: any) => (a.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                setLogs(data);
            }, (err: any) => {});
    }, [userId]);
    return (
        <div className="space-y-2">
            {logs.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.sender === 'user' ? 'items-start' : 'items-end'}`}>
                    <div className={`p-2 rounded-xl text-[10px] font-bold ${m.sender === 'user' ? 'bg-white border text-gray-800' : 'bg-[#2c3e50] text-white'}`}>
                        {m.text}
                    </div>
                </div>
            ))}
        </div>
    );
};


const QuickOfferModalContent: React.FC<{user: any, t: any, onComplete: () => void}> = ({user, t, onComplete}) => {
    const [item, setItem] = useState({ itemName: '', category: 'category_food', qty: 1, expiryDate: '' });
    const [posting, setPosting] = useState(false);

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (typeof firebase === 'undefined' || !firebase.firestore || !user) return;

        // Strict validation: Expiry date must be at least 1 month from post date for food category
        if (item.category === 'category_food') {
            const now = new Date();
            const expiry = new Date(item.expiryDate);
            const oneMonthLater = new Date();
            oneMonthLater.setMonth(now.getMonth() + 1);

            if (expiry < oneMonthLater) {
                alert("your offer had been rejected since the expired date of the food is less than 1 month");
                return;
            }
        }

        setPosting(true);
        try {
            const db = firebase.firestore();
            await db.collection('donations').add({
                ...item, 
                createdAt: firebase.firestore.FieldValue.serverTimestamp(), 
                userId: user.uid, 
                donorName: user.displayName || 'Donor',
                userClass: user.userClass || 'N/A'
            });

            const adminQuery = await db.collection('users').where('isAdmin', '==', true).get();
            adminQuery.forEach(async (adminDoc: any) => {
                await db.collection('notifications').add({
                    userId: adminDoc.id,
                    title: `New Offer: ${item.itemName}`,
                    message: `${user.displayName} from ${user.userClass || 'unknown class'} has offered an item.`,
                    type: 'offer',
                    read: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            alert("Offer Posted Successfully!");
            onComplete();
        } catch (err) { 
            alert("Failed to post offer."); 
        } finally { 
            setPosting(false); 
        }
    };

    // Helper to get today's date in YYYY-MM-DD for input min attribute
    const todayStr = new Date().toISOString().split('T')[0];

    return (
        <div className="pt-4">
            <h2 className="text-3xl font-black text-[#2c3e50] mb-8 uppercase italic">{t('offer_help')}</h2>
            <form onSubmit={handlePost} className="space-y-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t('item_name')}</label>
                    <input value={item.itemName} onChange={e => setItem({...item, itemName: e.target.value})} className="w-full p-4 rounded-2xl border-2 outline-none font-bold" required placeholder={t('item_name')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t('status')}</label>
                        <select 
                            value={item.category} 
                            onChange={e => setItem({...item, category: e.target.value})} 
                            className="w-full p-4 rounded-2xl border-2 outline-none font-bold bg-white"
                        >
                            <option value="category_food">{t('category_food')}</option>
                            <option value="category_books">{t('category_books')}</option>
                            <option value="category_furniture">{t('category_furniture')}</option>
                            <option value="category_toiletries">{t('category_toiletries')}</option>
                            <option value="category_others">{t('category_others')}</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2">{t('quantity')}</label>
                        <input type="number" value={item.qty} min="1" onChange={e => setItem({...item, qty: Number(e.target.value)})} className="w-full p-4 rounded-2xl border-2 outline-none font-bold" required />
                    </div>
                </div>
                {item.category === 'category_food' && (
                    <div className="space-y-1 animate-in slide-in-from-top-2">
                        <label className="text-[10px] font-black text-red-500 uppercase tracking-widest ml-2">{t('expiry_date_food_warning')}</label>
                        <input 
                            type="date" 
                            value={item.expiryDate} 
                            min={todayStr}
                            onChange={e => setItem({...item, expiryDate: e.target.value})} 
                            className="w-full p-4 rounded-2xl border-2 outline-none font-bold border-red-100 focus:border-red-400" 
                            required={item.category === 'category_food'} 
                        />
                    </div>
                )}
                <button type="submit" disabled={posting} className="w-full bg-[#3498db] text-white py-5 rounded-2xl font-black text-xl shadow-xl uppercase transition-transform active:scale-95">
                    {posting ? '...' : t('post_offer')}
                </button>
            </form>
        </div>
    );
};

const SupportChatBody: React.FC<{userId: string, userName: string, t: any, isGuest: boolean}> = ({userId, userName, t, isGuest}) => {
    const [msgs, setMsgs] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!userId || typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        const unsub = db.collection('support_chats')
            .where('userId', '==', userId)
            .onSnapshot((snap: any) => {
                const data = snap.docs.map((d: any) => d.data());
                data.sort((a: any, b: any) => (a.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                setMsgs(data);
            }, (err: any) => {});
        return unsub;
    }, [userId]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [msgs]);

    const send = async (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() === '' || !userId || typeof firebase === 'undefined' || !firebase.firestore) return;
        const msgText = input;
        setInput('');
        await firebase.firestore().collection('support_chats').add({
            userId, userName: userName || 'Guest', text: msgText, sender: 'user', isGuest,
            createdAt: firebase.firestore.Timestamp.now()
        });
    };

    return (
        <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgs.map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-bold ${m.sender === 'user' ? 'bg-[#3498db] text-white' : 'bg-[#2c3e50] text-white'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
            </div>
            <form onSubmit={send} className="p-4 bg-white border-t flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)} placeholder={t('type_message')} className="flex-1 bg-gray-100 p-3 rounded-2xl text-xs font-bold outline-none border-2 border-transparent focus:border-[#3498db] transition-all" />
                <button className="bg-[#3498db] text-white w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"><i className="fas fa-paper-plane text-xs"></i></button>
            </form>
        </div>
    );
};

const AdminPanelContent: React.FC<{t: any, user: any | null, isKoperasiMenu?: boolean, onUpdateUser?: (data: any) => void}> = ({t, user, isKoperasiMenu, onUpdateUser}) => {
    const isAdmin = user?.isAdmin || user?.email === 'admin@gmail.com';
    const isKoperasi = user?.isKoperasi || user?.email === 'koperasi@gmail.com';

    const [activeTab, setActiveTab] = useState<'users' | 'items' | 'vouchers' | 'chats'>(isKoperasi ? 'vouchers' : 'users');
    const [data, setData] = useState<{users: any[], items: any[], redemptions: any[], completedItems: any[], supportChats: any[]}>({users: [], items: [], redemptions: [], completedItems: [], supportChats: []});
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState<any>(null);
    const [activeSupportUser, setActiveSupportUser] = useState<any>(null);
    const [adminReply, setAdminReply] = useState('');
    const [selectedOffer, setSelectedOffer] = useState<any>(null);
    const [declineReason, setDeclineReason] = useState('');
    const [showDeclineModal, setShowDeclineModal] = useState(false);
    const [awardingPoints, setAwardingPoints] = useState<number>(0);
    const [isAwardingMode, setIsAwardingMode] = useState(false);

    useEffect(() => {
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        
        let unsubs: Array<() => void> = [];
        
        if (isAdmin) {
            unsubs.push(db.collection('users').onSnapshot((snap: any) => setData(prev => ({...prev, users: snap.docs.map((d: any) => ({...d.data(), uid: d.id}))}))));
            unsubs.push(db.collection('donations').onSnapshot((snap: any) => {
                const items = snap.docs.map((d: any) => ({...d.data(), id: d.id}));
                items.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                setData(prev => ({...prev, items}));
            }));
            unsubs.push(db.collection('completed_donations').onSnapshot((snap: any) => setData(prev => ({...prev, completedItems: snap.docs.map((d: any) => ({...d.data(), id: d.id}))}))));
            unsubs.push(db.collection('support_chats').onSnapshot((snap: any) => {
                const rawDocs = snap.docs.map((d: any) => d.data());
                const grouped: any[] = [];
                const seen = new Set();
                rawDocs.sort((a: any, b: any) => (a.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                rawDocs.forEach((doc: any) => {
                    if (!seen.has(doc.userId)) {
                        grouped.push({ userId: doc.userId, userName: doc.userName, lastMsg: doc.text, isGuest: doc.isGuest });
                        seen.add(doc.userId);
                    }
                });
                setData(prev => ({...prev, supportChats: grouped}));
            }));
        }

        unsubs.push(db.collection('redeem_history').onSnapshot((snap: any) => {
            const redemptions = snap.docs.map((d: any) => ({...d.data(), id: d.id}));
            redemptions.sort((a: any, b: any) => (b.redeemedAt?.toMillis?.() || 0) - (a.redeemedAt?.toMillis?.() || 0));
            setData(prev => ({...prev, redemptions}));
        }));

        return () => unsubs.forEach(u => u());
    }, [isAdmin]);

    const filteredUsers = useMemo(() => {
        if (!searchQuery) return data.users;
        const q = searchQuery.toLowerCase();
        return data.users.filter(u => 
            u.displayName?.toLowerCase().includes(q) || 
            u.email?.toLowerCase().includes(q) ||
            u.userClass?.toLowerCase().includes(q)
        );
    }, [data.users, searchQuery]);

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        try {
            await firebase.firestore().collection('users').doc(editingUser.uid).update({
                displayName: editingUser.displayName,
                points: Number(editingUser.points),
                phone: editingUser.phone || '',
                address: editingUser.address || '',
                birthdate: editingUser.birthdate || '',
                userClass: editingUser.userClass || '',
                password: editingUser.password || ''
            });
            
            if (onUpdateUser) {
                await onUpdateUser(editingUser);
            }

            alert(t('save') + "!");
            setEditingUser(null);
        } catch (err: any) {}
    };

    const sendAdminReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (adminReply.trim() === '' || !activeSupportUser || typeof firebase === 'undefined' || !firebase.firestore) return;
        const text = adminReply;
        setAdminReply('');
        await firebase.firestore().collection('support_chats').add({
            userId: activeSupportUser.userId,
            userName: activeSupportUser.userName,
            text, sender: 'admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        if (!activeSupportUser.isGuest) {
            await firebase.firestore().collection('notifications').add({
                userId: activeSupportUser.userId,
                title: t('support_msg_notif'),
                message: text,
                type: 'message',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
    };

    const handleAcceptRedeem = async (redeem: any) => {
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        try {
            await db.collection('redeem_history').doc(redeem.id).update({ status: 'confirmed' });
            await db.collection('notifications').add({
                userId: redeem.userId,
                title: t('redeem_confirmed'),
                message: t('redeem_confirmed_msg').replace('{item}', redeem.itemName).replace('{code}', redeem.rdCode || 'N/A'),
                type: 'status',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            alert(t('redemption_accepted'));
        } catch (e) {}
    };

    const handleInitialAccept = () => {
        setIsAwardingMode(true);
        setAwardingPoints(0);
    };

    const approveOffer = async (offer: any) => {
        if (awardingPoints < 0) {
            alert(t('points_award_input'));
            return;
        }

        const confirmMsg = t('points_award_confirm')
            .replace('{pts}', awardingPoints.toString())
            .replace('{user}', offer.donorName);

        if (!window.confirm(confirmMsg)) return;

        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        try {
            const donorRef = db.collection('users').doc(offer.userId);
            await db.runTransaction(async (transaction: any) => {
                const donorDoc = await transaction.get(donorRef);
                const currentPoints = donorDoc.exists ? (donorDoc.data().points || 0) : 0;
                transaction.update(donorRef, { points: currentPoints + awardingPoints });
                transaction.set(db.collection('completed_donations').doc(offer.id), {
                    ...offer, completedAt: firebase.firestore.FieldValue.serverTimestamp(), confirmedBy: user.uid, earnedPoints: awardingPoints
                });
                transaction.delete(db.collection('donations').doc(offer.id));
            });

            await db.collection('notifications').add({
                userId: offer.userId,
                title: t('points_earned_notif'),
                message: `${t('verified')}! ${t('points_earned')}: ${awardingPoints}`,
                type: 'status',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert(t('verified') + "!");
            setIsAwardingMode(false);
            setAwardingPoints(0);
            setSelectedOffer(null);
        } catch (err: any) {
            alert(t('approval_failed'));
        }
    };

    const declineOffer = async (offer: any) => {
        if (!declineReason.trim()) {
            alert(t('decline_reason_label'));
            return;
        }
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        const db = firebase.firestore();
        try {
            await db.collection('notifications').add({
                userId: offer.userId,
                title: t('offer_declined'),
                message: t('offer_declined_msg').replace('{item}', offer.itemName).replace('{reason}', declineReason),
                type: 'message',
                read: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            await db.collection('donations').doc(offer.id).delete();
            alert(t('offer_declined_removed'));
            setShowDeclineModal(false);
            setDeclineReason('');
            setSelectedOffer(null);
        } catch (err) {}
    };

    const handleResetRD = async () => {
        if (!window.confirm("Are you sure you want to reset the redemption code to RD0001? New redemptions will start from 0001 again.")) return;
        if (typeof firebase === 'undefined' || !firebase.firestore) return;
        try {
            await firebase.firestore().collection('counters').doc('redemptions').set({ count: 0 });
            alert(t('counter_reset_success'));
        } catch (e) {
            alert(t('counter_reset_failed'));
        }
    };

    return (
        <div className={`h-full flex flex-col ${isKoperasiMenu ? '' : 'p-4 sm:p-6'} overflow-hidden bg-white admin-panel-container`}>
            <div className="flex justify-between items-start mb-4 shrink-0">
                <h2 className="text-xl font-black italic uppercase text-[#2c3e50] border-b-4 border-[#3498db] pb-2 inline-block">{isAdmin ? t('admin_panel') : t('koperasi_panel')}</h2>
                {isAdmin && activeTab === 'vouchers' && (
                    <button onClick={handleResetRD} className="text-[8px] font-black uppercase bg-red-100 text-red-500 px-2 py-1 rounded-md hover:bg-red-200 transition-colors">{t('reset_codes')}</button>
                )}
            </div>
            <div className="flex flex-wrap gap-1 mb-4 shrink-0">
                {isAdmin && (
                    <>
                        <button onClick={() => { setActiveTab('users'); setEditingUser(null); setActiveSupportUser(null); setSelectedOffer(null); }} className={`flex-1 min-w-[60px] py-2 rounded-xl text-[7px] font-black uppercase ${activeTab === 'users' ? 'bg-[#2c3e50] text-white' : 'bg-gray-100'}`}>{t('users')}</button>
                        <button onClick={() => { setActiveTab('items'); setEditingUser(null); setActiveSupportUser(null); setSelectedOffer(null); }} className={`flex-1 min-w-[60px] py-2 rounded-xl text-[7px] font-black uppercase ${activeTab === 'items' ? 'bg-[#2c3e50] text-white' : 'bg-gray-100'}`}>{t('offers')}</button>
                        <button onClick={() => { setActiveTab('chats'); setEditingUser(null); setActiveSupportUser(null); setSelectedOffer(null); }} className={`flex-1 min-w-[60px] py-2 rounded-xl text-[7px] font-black uppercase ${activeTab === 'chats' ? 'bg-[#2c3e50] text-white' : 'bg-gray-100'}`}>{t('support')}</button>
                    </>
                )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
                {activeTab === 'users' && isAdmin && (
                    <div className="space-y-4">
                        <div className="bg-[#2c3e50] text-white p-4 rounded-2xl shadow-inner flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest">{t('total_citizens')}</span>
                            <span className="text-xl font-black text-[#f39c12]">{data.users.length}</span>
                        </div>
                        {editingUser ? (
                            <form onSubmit={handleUpdateUser} className="bg-gray-50 p-4 rounded-2xl border space-y-3">
                                <AdminInput label={t('full_name')} value={editingUser.displayName} onChange={v => setEditingUser({...editingUser, displayName: v})} />
                                <AdminInput label={t('points')} type="number" value={editingUser.points} onChange={v => setEditingUser({...editingUser, points: v})} />
                                <AdminInput label={t('phone_number')} value={editingUser.phone} onChange={v => setEditingUser({...editingUser, phone: v})} />
                                <AdminInput label={t('home_address')} value={editingUser.address} onChange={v => setEditingUser({...editingUser, address: v})} />
                                <AdminInput label={t('birthdate')} value={editingUser.birthdate} onChange={v => setEditingUser({...editingUser, birthdate: v})} />
                                <AdminInput label={t('class_label')} value={editingUser.userClass} onChange={v => setEditingUser({...editingUser, userClass: v})} />
                                <AdminInput label={t('password_label')} value={editingUser.password || ''} onChange={v => setEditingUser({...editingUser, password: v})} />
                                <div className="flex gap-2">
                                    <button type="submit" className="flex-1 bg-[#2ecc71] text-white py-2 rounded-lg font-black text-[10px] uppercase">{t('save')}</button>
                                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-black text-[10px] uppercase">{t('cancel')}</button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <input placeholder={t('search_placeholder')} className="w-full bg-gray-50 border p-3 rounded-xl text-xs font-bold outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                {filteredUsers.map((u, index) => (
                                    <div key={u.uid} className="bg-white p-3 border rounded-xl flex items-center gap-4 group">
                                        <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-[10px] font-black text-gray-400 shrink-0">#{index + 1}</div>
                                        <div className="flex-1 overflow-hidden">
                                            <div className="font-black text-[10px] uppercase truncate">{u.displayName}</div>
                                            <div className="text-[9px] text-gray-400 truncate">{u.points} pts • {u.email} {u.password ? `• PW: ${u.password}` : ''}</div>
                                        </div>
                                        <button onClick={() => setEditingUser(u)} className="text-[#3498db] opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-blue-50 rounded-lg"><i className="fas fa-edit"></i></button>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'items' && isAdmin && (
                    selectedOffer ? (
                        <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 space-y-5 animate-in slide-in-from-right-2 relative">
                            {showDeclineModal && (
                                <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300">
                                        <h4 className="text-[10px] font-black uppercase text-red-500 mb-4 tracking-widest">{t('decline_reason_label')}</h4>
                                        <textarea 
                                            value={declineReason} 
                                            onChange={e => setDeclineReason(e.target.value)} 
                                            className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl outline-none text-xs font-bold mb-4 focus:border-red-200 transition-all"
                                            placeholder={t('type_here_placeholder')}
                                            rows={4}
                                        />
                                        <div className="flex gap-2">
                                            <button 
                                                disabled={declineReason.trim().length === 0}
                                                onClick={() => declineOffer(selectedOffer)} 
                                                className={`flex-1 py-3 rounded-xl font-black uppercase text-[9px] shadow-lg transition-all ${
                                                    declineReason.trim().length === 0 
                                                    ? 'bg-red-300 text-white/50 cursor-not-allowed blur-[1px] opacity-70' 
                                                    : 'bg-red-500 text-white active:scale-95'
                                                }`}
                                            >
                                                {t('confirm_decline')}
                                            </button>
                                            <button onClick={() => setShowDeclineModal(false)} className="bg-gray-100 text-gray-500 px-4 py-3 rounded-xl font-black uppercase text-[9px]">{t('cancel')}</button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {isAwardingMode && (
                                <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
                                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in zoom-in duration-300">
                                        <h3 className="text-xl font-black uppercase italic text-[#2c3e50] mb-2">{t('points_award_input')}</h3>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-6">{selectedOffer.donorName} • {selectedOffer.itemName}</p>
                                        <AdminInput 
                                            label={t('points_amount')} 
                                            type="number" 
                                            value={awardingPoints} 
                                            onChange={setAwardingPoints} 
                                            placeholder={t('enter_points_placeholder')}
                                        />
                                        <div className="flex gap-3 pt-6">
                                            <button onClick={() => approveOffer(selectedOffer)} className="flex-1 bg-[#2ecc71] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl active:scale-95 transition-all">
                                                {t('confirm')}
                                            </button>
                                            <button onClick={() => setIsAwardingMode(false)} className="bg-gray-100 text-gray-500 px-6 py-4 rounded-2xl font-black uppercase text-xs">
                                                {t('cancel')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button onClick={() => setSelectedOffer(null)} className="text-[10px] font-black uppercase text-gray-400 hover:text-[#2c3e50] transition-colors flex items-center gap-2">
                                <i className="fas fa-arrow-left"></i> {t('back_to_list')}
                            </button>
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-xl font-black uppercase italic text-[#2c3e50] leading-tight">{selectedOffer.itemName}</h3>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="bg-[#3498db] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">{t('quantity')}: {selectedOffer.qty}</span>
                                        <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                            {selectedOffer.category?.startsWith('category_') ? t(selectedOffer.category) : selectedOffer.category}
                                        </span>
                                    </div>
                                    {selectedOffer.expiryDate && (
                                        <p className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-widest">{t('expiry_date')}: {selectedOffer.expiryDate}</p>
                                    )}
                                </div>
                                <div className="space-y-4 pt-4 border-t border-gray-200">
                                    <div>
                                        <p className="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-1">{t('donor_details')}</p>
                                        <div className="bg-white p-3 rounded-2xl border border-gray-100">
                                            <p className="text-sm font-bold text-[#2c3e50]">{selectedOffer.donorName}</p>
                                            <p className="text-[10px] font-bold text-[#3498db] uppercase">{selectedOffer.userClass || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {!data.completedItems.find(c => c.id === selectedOffer.id) && (
                                    <>
                                        <button onClick={handleInitialAccept} className="flex-1 bg-[#2ecc71] hover:bg-[#27ae60] text-white py-4 rounded-2xl font-black uppercase text-xs shadow-xl shadow-green-100 transition-all active:scale-95">
                                            <i className="fas fa-check-circle mr-2"></i> {t('confirm')}
                                        </button>
                                        <button onClick={() => setShowDeclineModal(true)} className="flex-1 bg-red-50 text-red-500 py-4 rounded-2xl font-black uppercase text-xs hover:bg-red-100 transition-colors active:scale-95 shadow-xl shadow-red-100">
                                            <i className="fas fa-times-circle mr-2"></i> {t('decline')}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest flex items-center gap-2 px-1">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> {t('pending_approval')}
                                </h3>
                                {data.items.length === 0 ? <p className="text-[10px] text-gray-300 italic px-1">{t('nothing_here')}</p> : data.items.map(i => (
                                    <div key={i.id} onClick={() => setSelectedOffer(i)} className="bg-white p-4 border border-gray-100 rounded-2xl mb-2 flex justify-between items-center cursor-pointer hover:border-[#3498db] transition-all">
                                        <div className="flex-1">
                                            <div className="font-black text-xs uppercase text-[#2c3e50]">{i.itemName}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">{i.donorName} ({i.userClass || 'N/A'}) • {i.qty} qty</div>
                                        </div>
                                        <i className="fas fa-chevron-right text-gray-200"></i>
                                    </div>
                                ))}
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest flex items-center gap-2 px-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500"></span> {t('verified')}
                                </h3>
                                {data.completedItems.map(i => (
                                    <div key={i.id} onClick={() => setSelectedOffer(i)} className="bg-white p-4 border border-green-50 rounded-2xl mb-2 flex justify-between items-center opacity-70 cursor-pointer">
                                        <div className="flex-1">
                                            <div className="font-black text-xs uppercase text-[#2c3e50]">{i.itemName}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase">{i.donorName} ({i.userClass || 'N/A'})</div>
                                        </div>
                                        <div className="text-green-500 font-black text-[9px] uppercase italic">{t('verified')}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                )}

                {activeTab === 'chats' && isAdmin && (
                    activeSupportUser ? (
                        <div className="flex flex-col h-full space-y-4">
                            <button onClick={() => setActiveSupportUser(null)} className="text-[10px] font-black uppercase text-gray-400 hover:text-[#2c3e50] transition-colors"><i className="fas fa-arrow-left mr-2"></i> {t('back_to_list')}</button>
                            <div className="flex-1 h-[300px] overflow-y-auto bg-gray-50 rounded-xl p-3 space-y-2 scrollbar-hide">
                                <AdminChatLogWindow userId={activeSupportUser.userId} />
                            </div>
                            <form onSubmit={sendAdminReply} className="flex gap-2">
                                <input value={adminReply} onChange={e => setAdminReply(e.target.value)} placeholder={t('type_message')} className="flex-1 bg-gray-100 p-2 rounded-xl text-xs font-bold border outline-none focus:border-[#2c3e50] transition-all" />
                                <button className="bg-[#2c3e50] text-white px-4 rounded-xl text-[10px] font-black hover:bg-black transition-colors">{t('send')}</button>
                            </form>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {data.supportChats.length === 0 ? <p className="text-[10px] text-gray-300 italic px-1">{t('nothing_here')}</p> : data.supportChats.map(s => (
                                <div key={s.userId} onClick={() => setActiveSupportUser(s)} className="bg-white p-4 border border-gray-100 rounded-2xl cursor-pointer hover:border-[#3498db] transition-all">
                                    <div className="font-black text-[11px] uppercase text-[#2c3e50]">{s.userName}</div>
                                    <div className="text-[10px] text-gray-400 truncate italic mt-1 font-medium">"{s.lastMsg}"</div>
                                </div>
                            ))}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};