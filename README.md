# ⚡ WarZone Control | Mission Control Dashboard

### Developed by: **Yossi Kat ®**

מערכת שליטה ובקרה (שו"ב) מתקדמת בזמן אמת, המנטרת שיגורים ואיומים רב-זירתיים על מדינת ישראל. המערכת משלבת נתוני פיקוד העורף עם סימולציות לוויניות וניתוח מסלולים בליסטיים.

---

## 🚀 תכונות עיקריות (Key Features)

* **Real-Time Alert Engine:** חיבור ישיר ל-API של פיקוד העורף להצגת אזעקות בזמן אמת.

* **Early Warning System:** התרעה מוקדמת — פוליגון מהבהב כתום כשמגיעה התרעה מפיקוד העורף, עובר לאדום מוצק ברגע שמתחילה האזעקה.

* **Multi-Theater Monitoring:** ניטור זירות שיגור מאיראן, לבנון, תימן וסוריה כולל מסלולי קשת (Arc) בליסטיים.

* **Tactical Targeting:** כוונת טקטית — IMPACT markers על המפה לסימון מיקום נפילה משוער.

* **Global to Local View:** זום אוטומטי מתצוגת ישראל → אזורי → תקריב למוקד האירוע.

* **Air Defense Visualization:** סוללות כיפת ברזל, קלע דוד, חץ, קרן ברזל, THAAD ופטריוט — שכבה אחודה (⚓).

* **Combined Forces Layer:** כוחות צה"ל, ארה"ב (CENTCOM), ספינות, צוללות, נושאת מטוסים — כפתור בסרגל.

* **Tactical UI/UX:** ממשק HUD שקוף (40% שקיפות) עם מצבי תצוגה: לילה, יום ולוויין.

* **Command Tools:** סרגל כלים מלא — מסך מלא, מרכוז, זום 3 רמות, שכבות.

* **Intel Feed:** מודיעין משולב (CENTCOM, NATO, טלגרם, חירום) — כותרות בלבד, פתיחה בלחיצה, סינון כפילויות.

* **Telegram Integration:** ניטור קבוצות בזמן אמת, זיהוי נפילות, סימון על המפה.

* **CENTCOM / NATO OSINT:** משיכת נתונים אוטומטית והשוואה צולבת.

---

## 🛠️ טכנולוגיות (Tech Stack)

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS
- **Backend:** Lovable Cloud (Edge Functions)
- **Real-time:** Realtime + Polling
- **Mapping:** Leaflet.js + Esri Satellite + CartoDB Dark
- **API:** Pikud HaOref, CENTCOM RSS, NATO, Telegram Bot API
- **Design:** Glassmorphism HUD overlays
