import {
  ArrowLeft,
  ArrowUpLeft,
  BarChart3,
  BrainCircuit,
  BookOpenText,
  Check,
  ChevronLeft,
  Clock3,
  Layers3,
  ListChecks,
  Sparkles,
  Target,
} from "lucide-react";
import { useLocation } from "wouter";

function ProjectHeader() {
  const [, setLocation] = useLocation();
  return (
    <header className="sfp-header">
      <a href="/" className="sfp-brand" aria-label="StudyFlow — الرئيسية">
        <span className="sfp-brand-mark"><span>sf</span></span>
        <span className="sfp-brand-copy"><b>StudyFlow</b><small>LEARNING SYSTEMS</small></span>
      </a>
      <nav className="sfp-nav sfp-case-nav" aria-label="التنقل في المشروع">
        <a className="sfp-nav-item" href="#case-overview" aria-label="نظرة عامة"><span className="sfp-nav-icon"><Layers3 size={18} /></span><span className="sfp-nav-tooltip">نظرة عامة</span></a>
        <a className="sfp-nav-item" href="#case-capabilities" aria-label="القدرات"><span className="sfp-nav-icon"><BrainCircuit size={18} /></span><span className="sfp-nav-tooltip">القدرات</span></a>
        <a className="sfp-nav-item" href="#case-stack" aria-label="التقنيات"><span className="sfp-nav-icon"><BookOpenText size={18} /></span><span className="sfp-nav-tooltip">التقنيات</span></a>
      </nav>
      <div className="sfp-header-actions"><button className="sfp-workspace-link" onClick={() => setLocation("/workspace")}>افتح المنصة <ArrowUpLeft size={15} /></button></div>
    </header>
  );
}

function DashboardPreview() {
  return (
    <div className="sfp-case-browser">
      <div className="sfp-case-browser-bar"><div className="sfp-browser-dots"><i /><i /><i /></div><span>studyflow / student-workspace</span><span className="sfp-browser-lock">PREVIEW</span></div>
      <div className="sfp-case-dashboard">
        <aside className="sfp-case-sidebar">
          <div className="sfp-case-mini-brand"><span>sf</span><b>StudyFlow</b></div>
          <div className="sfp-case-side-item active"><i /><span>لوحة اليوم</span></div>
          <div className="sfp-case-side-item"><i /><span>المهام</span></div>
          <div className="sfp-case-side-item"><i /><span>المكتبة</span></div>
          <div className="sfp-case-side-item"><i /><span>المخطط الذكي</span></div>
          <div className="sfp-case-side-item"><i /><span>التحليلات</span></div>
        </aside>
        <div className="sfp-case-main">
          <div className="sfp-case-greeting"><div><small>مساحة الدراسة / STUDYFLOW</small><b>خطتك، بصورة أوضح.</b><span>ملخص مرئي لمساحة الطالب</span></div><span className="sfp-case-avatar">S</span></div>
          <div className="sfp-case-kpis"><div><small>إنجاز المهام</small><b>72%</b><i /></div><div><small>مهام مفتوحة</small><b>08</b><i /></div><div><small>أهداف نشطة</small><b>03</b><i /></div></div>
          <div className="sfp-case-panels">
            <div className="sfp-case-chart"><div><b>إيقاع الأسبوع</b><small>نظرة على نشاطك</small></div><div className="sfp-case-chart-bars">{[38,56,44,76,51,88,66].map((n,i)=><i key={i} style={{height:\`\${n}%\`}} />)}</div><div className="sfp-case-chart-labels"><span>س</span><span>ح</span><span>ن</span><span>ث</span><span>ر</span><span>خ</span><span>ج</span></div></div>
            <div className="sfp-case-tasks"><b>الخطوة التالية</b><span><i /><em>مراجعة الدرس</em><small>25 دقيقة</small></span><span><i /><em>حل تدريبات</em><small>35 دقيقة</small></span><span><i /><em>تحديث الخطة</em><small>10 دقائق</small></span></div>
          </div>
        </div>
      </div>
      <div className="sfp-case-preview-note">معاينة تصميمية توضيحية — ليست بيانات حساب حقيقي</div>
    </div>
  );
}

export default function StudyFlowCaseStudy() {
  const [, setLocation] = useLocation();

  return (
    <div className="sfp-site sfp-case-site" dir="rtl">
      <ProjectHeader />
      <main>
        <section className="sfp-case-hero">
          <div className="sfp-case-hero-text">
            <a href="/#sfp-projects" className="sfp-case-back"><ChevronLeft size={15} /> كل المشاريع</a>
            <p className="sfp-case-eyebrow">STUDYFLOW / PROJECT 001</p>
            <h1>منصة <em>StudyFlow.</em></h1>
            <p>منظومة لإدارة التعلّم والتخطيط الدراسي، تربط أهداف الطالب ومهامه ومحتواه وتقدمه في مساحة واحدة.</p>
            <div className="sfp-case-actions">
              <button className="sfp-primary-action" onClick={() => setLocation("/workspace")}>شوف المشروع <ArrowUpLeft size={17} /></button>
              <a className="sfp-secondary-action" href="#case-overview">اكتشف التفاصيل <ArrowLeft size={16} /></a>
            </div>
          </div>
          <div className="sfp-case-hero-art"><DashboardPreview /></div>
          <div className="sfp-case-hero-index"><span>CASE STUDY</span><i /><span>001 — 2026</span></div>
        </section>

        <section className="sfp-case-meta" id="case-overview">
          <div><small>نوع المنتج</small><b>منصة تعليمية</b></div>
          <div><small>الدور</small><b>تصميم وتطوير المنتج</b></div>
          <div><small>التركيز</small><b>التخطيط · التعلّم · التحليل</b></div>
          <div><small>الحالة</small><b><span className="sfp-status-dot" /> تطوير مستمر</b></div>
        </section>

        <section className="sfp-case-overview">
          <div className="sfp-case-section-number"><span>01</span><i /> THE IDEA</div>
          <div className="sfp-case-overview-copy"><h2>الدراسة مش مهام منفصلة.</h2><p>StudyFlow بيتعامل مع الدراسة كمسار مترابط، مش قائمة مهام. التخطيط مرتبط بالأهداف، والأهداف مرتبطة بالتقدم، والمحتوى الدراسي له مكان داخل نفس التجربة.</p><p>الهدف هو تقليل التشتت وتقديم صورة مفهومة عن المطلوب الآن، وما تم إنجازه، وما يحتاج إلى إعادة ترتيب.</p></div>
        </section>

        <section className="sfp-case-capabilities" id="case-capabilities">
          <div className="sfp-case-section-number"><span>02</span><i /> INSIDE THE PRODUCT</div>
          <div className="sfp-case-capability-grid">
            <article><span><BrainCircuit size={22} /></span><small>01 / INTELLIGENCE</small><h3>مخطط ذكي</h3><p>تحويل الأهداف والمهام إلى خطة يومية، مع التحقق من الوقت والطاقة المتاحة.</p></article>
            <article><span><BookOpenText size={22} /></span><small>02 / LEARNING</small><h3>مكتبة دراسية</h3><p>تنظيم الكتب والمواد والفصول، وربط المحتوى بالتقدم الدراسي.</p></article>
            <article><span><ListChecks size={22} /></span><small>03 / EXECUTION</small><h3>مهام وروتين</h3><p>متابعة التنفيذ اليومي، والعادات، والمواعيد والمهام المفتوحة.</p></article>
            <article><span><BarChart3 size={22} /></span><small>04 / INSIGHTS</small><h3>تحليل الأداء</h3><p>ملخصات ومؤشرات تساعد على فهم الإنجاز واتخاذ قرارات أفضل.</p></article>
          </div>
        </section>

        <section className="sfp-case-visual">
          <div className="sfp-case-section-number"><span>03</span><i /> PRODUCT EXPERIENCE</div>
          <div className="sfp-case-visual-row">
            <div className="sfp-case-visual-copy"><h2>واجهة واحدة. <em>سياق كامل.</em></h2><p>لوحة اليوم تجمع المؤشرات والمهام والأهداف والمحتوى، بحيث يقدر الطالب يبدأ من أهم خطوة بدل ما يبحث عنها بين صفحات متفرقة.</p></div>
            <div className="sfp-case-ui-card sfp-case-ui-plan"><div className="sfp-ui-title"><Sparkles size={18} /><b>المخطط الذكي</b><span>PLAN</span></div><div className="sfp-ui-plan-row active"><i /><div><b>المهمة الأهم</b><small>مراجعة الدرس الحالي</small></div><em>25 د</em></div><div className="sfp-ui-plan-row"><i /><div><b>جلسة حل</b><small>تدريبات وتطبيق</small></div><em>40 د</em></div><div className="sfp-ui-plan-row"><i /><div><b>مراجعة سريعة</b><small>تثبيت النقاط الأساسية</small></div><em>15 د</em></div></div>
          </div>
          <div className="sfp-case-visual-row flipped">
            <div className="sfp-case-ui-card sfp-case-ui-insight"><div className="sfp-ui-title"><Target size={18} /><b>صورة التقدم</b><span>INSIGHT</span></div><div className="sfp-ui-progress"><div><strong>72%</strong><small>مؤشر إنجاز توضيحي</small></div><i /></div><div className="sfp-ui-progress-legend"><span><i /> مهام مكتملة</span><span><i /> مهام متبقية</span></div></div>
            <div className="sfp-case-visual-copy"><h2>الأرقام <em>لها معنى.</em></h2><p>المؤشرات مش للعرض فقط؛ دورها توضح ما الذي يتحرك بشكل جيد، وأين تحتاج الخطة إلى مراجعة أو تعديل.</p></div>
          </div>
        </section>

        <section className="sfp-case-stack" id="case-stack">
          <div className="sfp-case-section-number"><span>04</span><i /> THE BUILD</div>
          <div><h2>بنية قابلة <em>للتطور.</em></h2><p>المنتج مبني كبنية ويب متكاملة تفصل واجهة الاستخدام عن منطق الخادم وطبقة البيانات، مع مساحة لإضافة قدرات تعليمية وتكاملات جديدة تدريجيًا.</p></div>
          <div className="sfp-stack-tags"><span>React</span><span>TypeScript</span><span>Vite</span><span>Tailwind CSS</span><span>Node.js</span><span>tRPC</span><span>Drizzle ORM</span><span>MySQL</span><span>AI integration</span></div>
        </section>

        <section className="sfp-case-end">
          <div className="sfp-case-end-copy"><p>الخطوة التالية تبدأ من هنا.</p><h2>افتح <em>StudyFlow.</em></h2><span>ادخل إلى مساحة الطالب وشوف النسخة الحالية من المنتج.</span></div>
          <button className="sfp-primary-action" onClick={() => setLocation("/workspace")}>شوف المشروع <ArrowUpLeft size={17} /></button>
        </section>
      </main>
      <footer className="sfp-footer"><a href="/" className="sfp-footer-brand"><span className="sfp-brand-mark"><span>sf</span></span><b>StudyFlow</b></a><a href="/#sfp-projects"><ArrowLeft size={14} /> كل المشاريع</a><span>© 2026 StudyFlow</span></footer>
    </div>
  );
}
