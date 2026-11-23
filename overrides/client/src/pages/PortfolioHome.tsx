import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUpLeft,
  BarChart3,
  BookOpenText,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Code2,
  Folder,
  FolderOpen,
  Layers3,
  Menu,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { useLocation } from "wouter";

const navigation = [
  { label: "الفكرة", id: "sfp-story", icon: Sparkles },
  { label: "النظام", id: "sfp-system", icon: Layers3 },
  { label: "المشاريع", id: "sfp-projects", icon: Folder },
  { label: "طريقة العمل", id: "sfp-approach", icon: Workflow },
  { label: "الوصول", id: "sfp-access", icon: ArrowUpLeft },
];

const capabilities = [
  { icon: BrainCircuit, title: "تخطيط ذكي", copy: "خطة قابلة للتعديل حسب الوقت والمهام والتقدم الفعلي." },
  { icon: BookOpenText, title: "مسار تعلّم", copy: "مواد وكتب ومحتوى دراسي في مساحة واحدة مترابطة." },
  { icon: BarChart3, title: "صورة أوضح", copy: "متابعة الإنجاز والأهداف والعادات والمؤشرات الدراسية." },
  { icon: CalendarDays, title: "إيقاع واقعي", copy: "مهام وروتين وتقويم يساعدك تحافظ على الاستمرارية." },
  { icon: Code2, title: "بنية قابلة للتوسع", copy: "تجربة مبنية لتتطور مع احتياجات الطالب والنظام." },
  { icon: CheckCircle2, title: "تنفيذ ومراجعة", copy: "حوّل الخطة إلى خطوات قابلة للقياس والمراجعة." },
];

function PortfolioHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <header className="sfp-header">
      <a href="/" className="sfp-brand" aria-label="StudyFlow — الرئيسية">
        <span className="sfp-brand-mark"><span>sf</span></span>
        <span className="sfp-brand-copy"><b>StudyFlow</b><small>LEARNING SYSTEMS</small></span>
      </a>

      <nav className="sfp-nav" aria-label="التنقل الرئيسي">
        {navigation.map(({ label, id, icon: Icon }) => (
          <a key={id} className="sfp-nav-item" href={\`#\${id}\`} aria-label={label}>
            <span className="sfp-nav-icon"><Icon size={18} strokeWidth={1.7} /></span>
            <span className="sfp-nav-tooltip">{label}</span>
          </a>
        ))}
      </nav>

      <div className="sfp-header-actions">
        <button className="sfp-workspace-link" onClick={() => setLocation("/workspace")}>
          مساحة الطالب <ArrowUpLeft size={15} />
        </button>
        <button className="sfp-menu-toggle" onClick={() => setMenuOpen(v => !v)} aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {menuOpen && (
        <nav className="sfp-mobile-menu" aria-label="قائمة الهاتف">
          {navigation.map(item => <a key={item.id} href={\`#\${item.id}\`} onClick={() => setMenuOpen(false)}>{item.label}<ArrowUpLeft size={15} /></a>)}
          <button onClick={() => setLocation("/workspace")}>افتح مساحة الطالب<ArrowUpLeft size={15} /></button>
        </nav>
      )}
    </header>
  );
}

function FolderCard({ kind, title, subtitle, open, onToggle, children }: {
  kind: "system" | "projects";
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const Icon = open ? FolderOpen : Folder;
  return (
    <section className={\`sfp-folder-card sfp-folder-\${kind} \${open ? "is-open" : ""}\`}>
      <button className="sfp-folder-trigger" onClick={onToggle} aria-expanded={open}>
        <div className="sfp-folder-art" aria-hidden="true">
          <div className="sfp-folder-tab" />
          <div className="sfp-folder-back" />
          <div className="sfp-folder-paper sfp-paper-one" />
          <div className="sfp-folder-paper sfp-paper-two" />
          <div className="sfp-folder-front">
            <div className="sfp-folder-symbol"><Icon size={27} strokeWidth={1.5} /></div>
            <span>{kind === "system" ? "SYSTEM / 01" : "PROJECTS / 01"}</span>
          </div>
        </div>
        <div className="sfp-folder-copy">
          <span className="sfp-folder-eyebrow">{kind === "system" ? "داخل المنظومة" : "أعمال ومشاريع"}</span>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <span className="sfp-folder-open-label">{open ? "إغلاق المجلد" : "افتح المجلد"} <ArrowUpLeft size={15} /></span>
      </button>
      <div className="sfp-folder-expanded" aria-hidden={!open}>
        {children}
      </div>
    </section>
  );
}

function ProductMiniPreview() {
  return (
    <div className="sfp-mini-preview" aria-label="معاينة توضيحية لمساحة StudyFlow">
      <div className="sfp-mini-topbar"><span /><span /><span /><b>studyflow / workspace</b></div>
      <div className="sfp-mini-body">
        <aside className="sfp-mini-sidebar"><i /><i /><i /><i /><i /></aside>
        <div className="sfp-mini-content">
          <div className="sfp-mini-heading"><small>مساحة التعلّم</small><b>خطتك، بصورة أوضح.</b></div>
          <div className="sfp-mini-stats"><span><i /> <b>التقدم</b><strong>72%</strong></span><span><i /> <b>المهام</b><strong>08</strong></span><span><i /> <b>الأهداف</b><strong>03</strong></span></div>
          <div className="sfp-mini-lower">
            <div className="sfp-mini-chart"><b>إيقاع الأسبوع</b><div>{[34, 58, 43, 76, 51, 88, 64].map((height, i) => <i key={i} style={{ height: \`\${height}%\` }} />)}</div></div>
            <div className="sfp-mini-tasks"><b>الخطوة التالية</b><span /><span /><span /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioHome() {
  const [openFolder, setOpenFolder] = useState<"system" | "projects" | null>("projects");
  const [, setLocation] = useLocation();

  const toggleFolder = (key: "system" | "projects") => setOpenFolder(current => current === key ? null : key);

  return (
    <div className="sfp-site" dir="rtl">
      <PortfolioHeader />

      <main>
        <section className="sfp-hero" id="sfp-top">
          <div className="sfp-hero-grain" aria-hidden="true" />
          <div className="sfp-hero-copy">
            <p className="sfp-eyebrow"><span /> منظومة تعلّم مترابطة <b>·</b> STUDYFLOW</p>
            <h1 className="sfp-hero-title"><span>مش مجرد</span><span className="sfp-title-accent">جدول مذاكرة.</span><span>دي صورة كاملة.</span></h1>
            <p className="sfp-hero-description">StudyFlow بيجمع التخطيط، والتعلّم، ومتابعة التقدم في تجربة واحدة؛ عشان تعرف تبدأ منين، وتفهم وصلت لفين، وتحدد الخطوة اللي بعدها.</p>
            <div className="sfp-hero-actions">
              <a className="sfp-primary-action" href="#sfp-projects">استكشف المنظومة <ArrowLeft size={17} /></a>
              <button className="sfp-secondary-action" onClick={() => setLocation("/workspace")}>افتح مساحة الطالب <ArrowUpLeft size={16} /></button>
            </div>
          </div>

          <div className="sfp-hero-art" aria-hidden="true">
            <div className="sfp-art-halo" />
            <div className="sfp-art-orbit sfp-orbit-one" />
            <div className="sfp-art-orbit sfp-orbit-two" />
            <div className="sfp-art-core"><span>sf</span><i>STUDY / FLOW</i></div>
            <div className="sfp-art-chip sfp-chip-one">PLAN</div>
            <div className="sfp-art-chip sfp-chip-two">LEARN</div>
            <div className="sfp-art-chip sfp-chip-three">GROW</div>
            <div className="sfp-art-dot sfp-dot-one" />
            <div className="sfp-art-dot sfp-dot-two" />
          </div>

          <a href="#sfp-projects" className="sfp-scroll-cue"><span>اكتشف اللي جوّه</span><ArrowDown size={16} /></a>
          <div className="sfp-hero-index"><span>01</span><i /> <span>PLATFORM OVERVIEW</span></div>
        </section>

        <section className="sfp-folder-zone" id="sfp-projects">
          <div className="sfp-section-head">
            <div><p className="sfp-section-kicker">EXPLORE STUDYFLOW</p><h2>افتح المجلد. <em>شوف التفاصيل.</em></h2></div>
            <p>كل جزء من المنظومة له مكانه. ابدأ بالمكونات، أو افتح المشروع وشوف التجربة من الداخل.</p>
          </div>

          <div className="sfp-folder-grid">
            <FolderCard kind="system" title="مكوّنات المنظومة" subtitle="تخطيط، تعلّم، تحليل، ومتابعة." open={openFolder === "system"} onToggle={() => toggleFolder("system")}>
              <div className="sfp-capability-grid">
                {capabilities.map(({ icon: Icon, title, copy }, index) => (
                  <article className="sfp-capability" key={title} style={{ "--tile-index": index } as CSSProperties}>
                    <span><Icon size={19} strokeWidth={1.65} /></span>
                    <div><b>{title}</b><p>{copy}</p></div>
                  </article>
                ))}
              </div>
            </FolderCard>

            <FolderCard kind="projects" title="المشاريع" subtitle="شوف StudyFlow كمنتج متكامل." open={openFolder === "projects"} onToggle={() => toggleFolder("projects")}>
              <button className="sfp-project-file" onClick={() => setLocation("/projects/studyflow")}>
                <div className="sfp-project-thumb"><ProductMiniPreview /><span className="sfp-thumb-corner">SF / 001</span></div>
                <div className="sfp-project-file-copy">
                  <span>FEATURED PROJECT · 001</span>
                  <b>منصة StudyFlow</b>
                  <small>منظومة إدارة التعلّم الذكي</small>
                  <span className="sfp-project-see">شوف المشروع <ArrowLeft size={15} /></span>
                </div>
              </button>
            </FolderCard>
          </div>
        </section>

        <section className="sfp-statement" id="sfp-story">
          <div className="sfp-statement-label"><span>02</span><i /> THE IDEA</div>
          <div className="sfp-statement-content">
            <h2>من <em>التشتّت</em> إلى مسار واضح.</h2>
            <p>المشكلة مش إن الطالب محتاج مهام أكتر. المشكلة إنه محتاج يشوف الصورة كاملة: اللي خلّصه، واللي فاضله، وإيه اللي يستحق وقته دلوقتي.</p>
          </div>
          <div className="sfp-statement-mark" aria-hidden="true">“</div>
        </section>

        <section className="sfp-capabilities-section" id="sfp-system">
          <div className="sfp-section-head">
            <div><p className="sfp-section-kicker">ONE CONNECTED SPACE</p><h2>كل حاجة <em>في سياقها.</em></h2></div>
            <p>مش مجموعة أدوات منفصلة؛ أجزاء بتكمل بعضها داخل مساحة واحدة.</p>
          </div>
          <div className="sfp-feature-grid">
            <article className="sfp-feature-card sfp-feature-planner">
              <div className="sfp-feature-meta"><span>01 / PLAN</span><BrainCircuit size={20} /></div>
              <div className="sfp-feature-visual sfp-visual-plan"><div className="sfp-plan-line" /><div className="sfp-plan-block a" /><div className="sfp-plan-block b" /><div className="sfp-plan-block c" /><div className="sfp-plan-dot" /></div>
              <h3>خطة تتحرك معاك</h3><p>المخطط يحوّل الأهداف والمهام إلى خطوات قابلة للتنفيذ والمراجعة.</p>
            </article>
            <article className="sfp-feature-card sfp-feature-learn">
              <div className="sfp-feature-meta"><span>02 / LEARN</span><BookOpenText size={20} /></div>
              <div className="sfp-feature-visual sfp-visual-learn"><div className="sfp-book-spine" /><div className="sfp-book-page"><i /><i /><i /><i /></div><div className="sfp-book-tab">01</div></div>
              <h3>محتوى في مكان واحد</h3><p>مساحة للكتب والمواد الدراسية والتقدم، مرتبطة بروتين الطالب وخطته.</p>
            </article>
            <article className="sfp-feature-card sfp-feature-insight">
              <div className="sfp-feature-meta"><span>03 / INSIGHT</span><BarChart3 size={20} /></div>
              <div className="sfp-feature-visual sfp-visual-insight"><div className="sfp-insight-ring"><span>72<small>%</small></span></div><div className="sfp-insight-bars"><i /><i /><i /><i /><i /></div></div>
              <h3>تقدّم مفهوم</h3><p>مؤشرات واضحة تساعدك تفهم التزامك، وتراجع أداءك، وتحدد أولوياتك.</p>
            </article>
          </div>
        </section>

        <section className="sfp-approach" id="sfp-approach">
          <div className="sfp-approach-top"><p className="sfp-section-kicker">HOW THE SYSTEM WORKS</p><span>03 / THE FLOW</span></div>
          <h2>من أول خطوة، <em>لحد الصورة الكاملة.</em></h2>
          <div className="sfp-steps">
            <article><span>01</span><b>سجّل واقعك</b><p>المواد والأهداف والمهام اللي قدامك.</p></article>
            <article><span>02</span><b>رتّب الأولويات</b><p>حوّل المطلوب إلى خطة واقعية وواضحة.</p></article>
            <article><span>03</span><b>نفّذ وتابع</b><p>سجّل تقدمك وشوف أثره على بقية خطتك.</p></article>
            <article><span>04</span><b>راجع وعدّل</b><p>خلي قراراتك مبنية على اللي حصل فعلًا.</p></article>
          </div>
        </section>

        <section className="sfp-access" id="sfp-access">
          <div className="sfp-access-orb" aria-hidden="true"><span>sf</span></div>
          <div className="sfp-access-copy">
            <p className="sfp-section-kicker">YOUR NEXT STEP</p>
            <h2>ابدأ من <em>مساحتك.</em></h2>
            <p>افتح StudyFlow، وخلّي خطتك الدراسية قدامك بدل ما تفضل متوزعة بين كذا مكان.</p>
            <button className="sfp-primary-action" onClick={() => setLocation("/workspace")}>ادخل إلى StudyFlow <ArrowUpLeft size={17} /></button>
          </div>
        </section>
      </main>

      <footer className="sfp-footer">
        <a href="#sfp-top" className="sfp-footer-brand"><span className="sfp-brand-mark"><span>sf</span></span><b>StudyFlow</b></a>
        <span>مساحة واحدة. رؤية أوضح.</span>
        <a href="/workspace">مساحة الطالب <ArrowUpLeft size={14} /></a>
      </footer>
    </div>
  );
}
