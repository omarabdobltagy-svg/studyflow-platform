# إعداد تسجيل الدخول باستخدام Google في SIE

## ما تم تنفيذه في التطبيق

- الدخول يتم عبر Google OpenID Connect باستخدام Authorization Code Flow وPKCE.
- الخادم يتحقق من توقيع ID Token ومصدره والجمهور والـ nonce وبريد Google الموثق.
- لا يوجد OTP للهاتف، ولا يتم إنشاء كلمة مرور داخل SIE.
- بعد نجاح Google، يدخل المستخدم إلى إعداد الحساب ويكتب الاسم ورقم الهاتف فقط.
- بعد ذلك يختار النظام، المسار/الشعبة، المادة التخصصية المطلوبة، والمدرس من الترشيحات المتاحة.
- يتم ربط حساب Google بحساب SIE قديم تلقائيًا فقط عندما يوجد تطابق وحيد مع بريد Google الموثق. إذا ظهرت حسابات متعددة بنفس البريد، يتوقف الربط بدل دمج بيانات غير مؤكدة.
- رقم الهاتف لا يُعد موثقًا لأن OTP غير مستخدم.

## متغيرات البيئة المطلوبة

أضف القيم التالية إلى خدمة التطبيق في Railway:

- GOOGLE_CLIENT_ID: OAuth 2.0 Client ID من نوع Web application.
- GOOGLE_CLIENT_SECRET: Client Secret المطابق.
- GOOGLE_REDIRECT_URI: https://studyflow-app-production.up.railway.app/api/oauth/google/callback للإنتاج.

لا تضع الأسرار في GitHub أو ملفات المصدر أو متغيرات VITE_ المكشوفة للمتصفح.

## Google Cloud Console

1. افتح Google Cloud Console وأنشئ أو اختر مشروعًا مخصصًا لـ SIE.
2. فعّل OAuth consent screen وأكمل بيانات التطبيق وسياسة الخصوصية والدعم المطلوبة.
3. أنشئ OAuth Client ID من نوع Web application.
4. أضف الدومين الفعلي إلى Authorized JavaScript origins.
5. أضف عنوان callback أعلاه حرفيًا إلى Authorized redirect URIs.
6. خزّن Client ID وClient Secret في Railway Variables بالأسماء المحددة.
7. بعد تعيين المتغيرات، أعد نشر الخدمة، ثم اختبر تسجيل الدخول من نافذة خاصة وحساب Google تجريبي.

## حالة الإطلاق

هذه التعديلات لا تنشر التطبيق تلقائيًا. يجب إعداد بيانات Google في Railway أولًا. كما أن نشر الإنتاج الحالي متوقف على إصلاح ترحيل قاعدة البيانات الذي يتضمن هذا الفرع إصلاحه؛ راجع سجلات Railway قبل أي نشر.