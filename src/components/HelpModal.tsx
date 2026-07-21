import {
  X,
  HelpCircle,
  MessageSquareText,
  Tag,
  AlertTriangle,
  ListTodo,
  BookUser,
  LayoutGrid,
  Search,
  Users,
  ArrowLeftRight,
} from 'lucide-react'

interface HelpModalProps {
  open: boolean
  onClose: () => void
}

interface Section {
  icon: typeof HelpCircle
  color: string
  title: string
  items: string[]
}

const SECTIONS: Section[] = [
  {
    icon: MessageSquareText,
    color: 'text-noc-accent bg-noc-accent/15 ring-noc-accent/30',
    title: 'יומן הצ׳אט',
    items: [
      'כל משמרת (בוקר / ערב / לילה) מתנהלת כשיחת צ׳אט נפרדת — בחרו את המשמרת מהלשוניות למעלה.',
      'כתבו עדכון ובחרו נוקיסט מהתפריט ליד תיבת הכתיבה, ואז שלחו עם Enter.',
      'אפשר להדביק צילום מסך ישירות עם Ctrl+V, או לצרף קובץ עם סיכת הנייר.',
      'העבירו את העכבר מעל הודעה כדי לנעוץ, להעתיק, לערוך, למחוק או לסמן שראיתם אותה.',
      'ניתן לשלוח הודעה מראש למשמרת או תאריך אחר דרך הכפתור "למועד אחר".',
    ],
  },
  {
    icon: Tag,
    color: 'text-sky-500 bg-sky-500/15 ring-sky-500/30',
    title: 'תיוגים',
    items: [
      'כל הודעה אפשר לתייג כ"עדכון" רגיל או בתיוג ייעודי כמו תקלה, מעקב, תחזוקה ועוד.',
      'לחצו על עיפרון העריכה ליד התיוגים כדי להוסיף, לערוך שם/צבע או למחוק תיוגים (מלבד "עדכון" ו"תקלה" שהם קבועים במערכת).',
    ],
  },
  {
    icon: AlertTriangle,
    color: 'text-red-500 bg-red-500/15 ring-red-500/30',
    title: 'עמודת תקלות',
    items: [
      'הודעה שמתויגת "תקלה" נוצרת אוטומטית בעמודת התקלות (סמל המשולש למעלה) ומעדכנת את סטטוס המשמרת.',
      'בזמן היצירה אפשר לבחור רמת דחיפות (נמוך/בינוני/גבוה/קריטי) — היא תוצג גם בהודעה בצ׳אט.',
      'לכל תקלה יש ציר זמן משלה בעמודה — אפשר להוסיף עדכוני סטטוס, לצרף קבצים, לערוך או למחוק.',
      'הודעת המשך בצ׳אט אפשר לשייך לתקלה פתוחה (כפתור "שיוך לתקלה") — היא תתווסף אוטומטית לציר הזמן של התקלה.',
      'לחיצה על "סימון כטופל" (בצ׳אט או בעמודה) פותחת חלון סגירה: לתעד איך נפתרה התקלה, לסמן שנפתרה מעצמה, או לדלג.',
      'תקלות שנסגרו עוברות לארכיון (סמל התיבה בעמודת התקלות) שם אפשר לחפש, לערוך, למחוק או לפתוח מחדש.',
    ],
  },
  {
    icon: ListTodo,
    color: 'text-emerald-500 bg-emerald-500/15 ring-emerald-500/30',
    title: 'משימות',
    items: [
      'רשימת המשימות הפתוחות מוצגת כפתקיות צבעוניות בצד — לחצו על סמל הרשימה למעלה כדי לפתוח את הפאנל המלא.',
      'ניתן להגדיר משימה למשמרת מסוימת, לנוקיסט ספציפי, לתאריך קבוע או כמשימה חוזרת.',
    ],
  },
  {
    icon: BookUser,
    color: 'text-violet-500 bg-violet-500/15 ring-violet-500/30',
    title: 'ספר טלפונים ויומן תפעול',
    items: [
      'ספר הטלפונים (סמל אנשי הקשר) מרכז אנשי קשר לאסקלציה.',
      'יומן התפעול (סמל הספר) מרכז נהלים והוראות עבודה קבועות.',
    ],
  },
  {
    icon: LayoutGrid,
    color: 'text-noc-accent2 bg-noc-accent2/15 ring-noc-accent2/30',
    title: 'תצוגה כללית וחיפוש',
    items: [
      '"תצוגה כללית" מציגה סיכום של שלוש המשמרות ביום הנבחר יחד.',
      'ניתן לחפש בכל התאריכים והמשמרות דרך שורת החיפוש מעל הצ׳אט.',
    ],
  },
  {
    icon: ArrowLeftRight,
    color: 'text-amber-500 bg-amber-500/15 ring-amber-500/30',
    title: 'מסירת משמרת',
    items: [
      'תקלות פתוחות ממשמרות קודמות מופיעות כבאנר "מעקב ממשמרות קודמות" — אפשר לסמן אותן כטופלו ישירות משם.',
    ],
  },
]

export default function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-x-0 top-0 z-[81] mx-auto flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-b-2xl border border-t-0 border-noc-border bg-noc-panel shadow-2xl sm:top-6 sm:rounded-2xl sm:border-t">
        <div className="flex items-center justify-between border-b border-noc-border px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-noc-t1">
            <HelpCircle className="h-5 w-5 text-noc-accent" />
            איך משתמשים באפליקציה
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-noc-t3 hover:bg-noc-panel2 hover:text-noc-t1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          <p className="mb-4 text-sm leading-relaxed text-noc-t3">
            יומן משמרות NOC הוא כלי לתיעוד משמרות בזמן אמת, ניהול תקלות ומשימות, ומסירה מסודרת בין
            נוקיסטים. הנה סיכום קצר של החלקים המרכזיים:
          </p>
          <div className="space-y-4">
            {SECTIONS.map((section) => {
              const Icon = section.icon
              return (
                <div key={section.title} className="rounded-xl border border-noc-border bg-noc-panel2 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 ${section.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3 className="text-sm font-bold text-noc-t1">{section.title}</h3>
                  </div>
                  <ul className="space-y-1.5 ps-1">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex gap-2 text-xs leading-relaxed text-noc-t2">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-noc-t4" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-xl border border-noc-accent/30 bg-noc-accent/10 p-3.5">
            <Search className="mt-0.5 h-4 w-4 shrink-0 text-noc-accent" />
            <p className="text-xs leading-relaxed text-noc-t2">
              טיפ: אפשר תמיד לחזור למסך זה בלחיצה על סמל שאלת העזרה בפינת המסך.
            </p>
          </div>
          <div className="mt-2 flex items-start gap-2 rounded-xl border border-noc-border bg-noc-panel2 p-3.5">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-noc-t3" />
            <p className="text-xs leading-relaxed text-noc-t2">
              כל הפעולות במערכת מסונכרנות בזמן אמת בין כל הנוקיסטים המחוברים.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
