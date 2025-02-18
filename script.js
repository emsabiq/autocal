document.addEventListener("DOMContentLoaded", function () {
    var calendarEl = document.getElementById("calendar");
    var calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: "dayGridMonth",
        headerToolbar: {
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay"
        },
        events: [], // Mulai dengan event kosong
    });
    calendar.render();

    // URL Google Sheets API
    const SHEET_ID = "1xSUFNeaN9RVfITB2MRdMdgpK4jhnnZJX5-ojmyn919U";
    const API_KEY = "AIzaSyByrmPUeTtMY_IlNXn4AUt_lHRK65qw224";
    const SHEET_NAME = "Sheet1";
    const URL = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}?key=${API_KEY}`;

    // Cache untuk menghindari duplikasi event
    let cachedEvents = new Set();
    let sentEmails = new Set();
    let lastUpdateTimestamp = null;

    // Fungsi untuk mengambil data dan mengirim pengingat
    function checkAndSendReminders() {
        console.log("🔄 Mengambil data dari Google Sheets...");
        fetch(URL)
            .then(response => response.json())
            .then(data => {
                if (!data.values || data.values.length < 2) {
                    console.warn("❌ Tidak ada data yang ditemukan di Spreadsheet.");
                    return;
                }

                const rows = data.values;
                const now = new Date();
                let events = [];
                let currentEvents = [];
                let upcomingEvents = [];

                // Cek apakah data berubah
                let newUpdateTimestamp = Date.now();
                if (lastUpdateTimestamp && newUpdateTimestamp - lastUpdateTimestamp < 5000) {
                    console.log("⏳ Tidak perlu update, data belum berubah.");
                    return;
                }
                lastUpdateTimestamp = newUpdateTimestamp;

                rows.slice(1).forEach(row => {
                    if (row.length < 4) return; // Pastikan ada cukup data

                    let eventDate = row[2]?.trim();
                    let eventTime = row[3]?.trim();
                    let eventDateTime = eventDate && eventTime ? new Date(`${eventDate}T${eventTime}`) : null;

                    if (!eventDateTime || isNaN(eventDateTime.getTime())) return; // Skip jika tanggal tidak valid

                    let eventId = `${row[1] || "NoTitle"}-${eventDate}-${eventTime}`;

                    if (!cachedEvents.has(eventId)) {
                        let event = {
                            id: eventId,
                            title: row[1] || "Untitled Event",
                            start: eventDate,
                            time: eventTime,
                            description: row[4] || "No description",
                            pic: row[5] || "Not assigned",
                            email: row[6] || ""
                        };

                        events.push(event);
                        cachedEvents.add(eventId);

                        let today = now.toISOString().split("T")[0];

                        if (event.start === today) {
                            currentEvents.push(event);
                        } else if (eventDateTime > now) {
                            upcomingEvents.push(event);
                        }

                        // **Kirim Email Reminder jika event dalam 30 menit**
                        let timeDiff = (eventDateTime - now) / (1000 * 60);
                        let emailKey = `${event.email}-${event.title}-${event.start}-${event.time}`;

                        if (timeDiff > 0 && timeDiff <= 30 && !sentEmails.has(emailKey)) {
                            sendEmailReminder(event);
                            sentEmails.add(emailKey);
                        }

                        // **Kirim Email 1 Hari Sebelumnya pada pukul 08:00**
                        let eventDayBefore8AM = new Date(eventDateTime);
                        eventDayBefore8AM.setDate(eventDateTime.getDate() - 1);
                        eventDayBefore8AM.setHours(8, 0, 0, 0);

                        if (now >= eventDayBefore8AM && now < eventDateTime && !sentEmails.has(emailKey + "-1Day")) {
                            sendEmailReminderOneDayBefore(event);
                            sentEmails.add(emailKey + "-1Day");
                        }
                    }
                });

                // **Hapus event lama sebelum menambahkan yang baru**
                calendar.getEvents().forEach(event => event.remove());
                calendar.addEventSource(events);

                // Simpan event ke localStorage
                localStorage.setItem("calendarEvents", JSON.stringify(events));

                // **Update Sidebar Events**
                document.getElementById("current-event-list").innerHTML = currentEvents.length > 0 ?
                    currentEvents.map(event => `<li>${event.title} - ${event.time} - PIC: ${event.pic}</li>`).join('') :
                    "<li>Tidak ada acara hari ini</li>";

                document.getElementById("upcoming-event-list").innerHTML = upcomingEvents.length > 0 ?
                    upcomingEvents.map(event => `<li>${event.start} - ${event.time}: ${event.title} - PIC: ${event.pic}</li>`).join('') :
                    "<li>Tidak ada acara mendatang</li>";

                console.log("✅ Data diperbarui dan event ditampilkan di kalender.");
            })
            .catch(error => console.error("❌ Error fetching data: ", error));
    }

    // **Kirim Email Reminder**
    function sendEmailReminder(event) {
        console.log(`📧 Mengirim email reminder: ${event.title}`);
        fetch("https://api.smtp2go.com/v3/email/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "api_key": "api-38ADC2B54A98423D973A9AF9389EF644",
                "to": [event.email],
                "sender": "noreply@bsidoorprize.my.id",
                "subject": `🚀 Reminder: ${event.title} akan segera dimulai!`,
                "html_body": `
                    <h2>Halo, ${event.pic}!</h2>
                    <p>Acara <b>${event.title}</b> akan dimulai dalam 30 menit.</p>
                    <p><b>Deskripsi:</b> ${event.description}</p>
                    <p>📅 Tanggal: ${event.start} ⏰ Waktu: ${event.time}</p>
                    <p>🔔 Jangan lupa untuk bergabung tepat waktu!</p>
                    <p><i>Email ini dikirim otomatis oleh sistem.</i></p>
                `
            })
        }).catch(error => console.error("❌ Error sending email:", error));
    }

    // **Kirim Email 1 Hari Sebelumnya**
    function sendEmailReminderOneDayBefore(event) {
        console.log(`📧 Mengirim email reminder H-1: ${event.title}`);
        fetch("https://api.smtp2go.com/v3/email/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "api_key": "api-38ADC2B54A98423D973A9AF9389EF644",
                "to": [event.email],
                "sender": "noreply@bsidoorprize.my.id",
                "subject": `🚀 Reminder: ${event.title} akan dimulai besok pagi!`,
                "html_body": `
                    <h2>Halo, ${event.pic}!</h2>
                    <p>Besok pagi ada acara <b>${event.title}</b> yang akan berlangsung.</p>
                    <p><b>Deskripsi:</b> ${event.description}</p>
                    <p>📅 Tanggal: ${event.start} ⏰ Waktu: ${event.time}</p>
                    <p>🔔 Jangan lupa untuk mempersiapkan diri.</p>
                    <p><i>Email ini dikirim otomatis oleh sistem.</i></p>
                `
            })
        }).catch(error => console.error("❌ Error sending email:", error));
    }

    // Jalankan pertama kali saat halaman dimuat
    checkAndSendReminders();

    // Perbarui setiap 5 menit
    setInterval(checkAndSendReminders, 300000);

    // Pastikan event tetap ada setelah halaman di-refresh
    const savedEvents = localStorage.getItem("calendarEvents");
    if (savedEvents) {
        const parsedEvents = JSON.parse(savedEvents);
        parsedEvents.forEach(event => calendar.addEvent(event));
    }
});
