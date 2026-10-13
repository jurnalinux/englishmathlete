const STORAGE_KEY = 'mathleteEnglishStateV1';
const TOTAL_QUESTIONS = 50;

const materialMeta = {
  grammar: { name: 'Advanced Grammar' },
  reading: { name: 'Reading Comprehension' },
  tenses: { name: 'Tenses' },
  'general-knowledge': { name: 'General Knowledge in English' }
};

const allMaterials = Object.keys(materialMeta);

function makeEmptyMaterialState() {
  return {
    summaryDone: false,
    quizStarted: false,
    quizCompleted: false,
    answers: {},
    latestResult: null,
    discussionOpened: false,
    lastResultAt: null,
    lastAccessed: null
  };
}

function loadState() {
  const safeDefault = {
    currentView: 'home',
    currentMaterial: null,
    materials: {}
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return safeDefault;

    const parsed = JSON.parse(raw);
    const normalized = { ...safeDefault, ...parsed };
    normalized.materials = {};

    for (const key of allMaterials) {
      normalized.materials[key] = {
        ...makeEmptyMaterialState(),
        ...(parsed.materials && parsed.materials[key] ? parsed.materials[key] : {})
      };
    }

    return normalized;
  } catch (error) {
    console.warn('Unable to parse saved state, starting fresh.', error);
    return safeDefault;
  }
}

let state = loadState();

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getMaterialState(id) {
  if (!state.materials[id]) {
    state.materials[id] = makeEmptyMaterialState();
  }
  return state.materials[id];
}

function getQuestionBank(materialId) {
  const bankMap = {
    grammar: window.grammarQuestions,
    reading: window.readingQuestions,
    tenses: window.tensesQuestions,
    'general-knowledge': window.generalKnowledgeQuestions
  };
  return bankMap[materialId] || [];
}

function getStatusText(materialId) {
  const material = getMaterialState(materialId);
  if (material.quizCompleted) return 'Latihan selesai';
  if (material.summaryDone) return 'Materi selesai';
  if (material.quizStarted || material.answers && Object.keys(material.answers).length > 0) return 'Sedang dipelajari';
  return 'Belum dimulai';
}

function getProgressValue(materialId) {
  const material = getMaterialState(materialId);
  const answered = Object.keys(material.answers || {}).length;

  if (material.quizCompleted) return 100;
  if (material.summaryDone) {
    return Math.max(40, Math.min(99, 40 + (answered / TOTAL_QUESTIONS) * 60));
  }
  if (material.quizStarted || answered > 0) {
    return 25;
  }
  return 0;
}

function getOverallProgress() {
  const values = allMaterials.map((materialId) => getProgressValue(materialId));
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

function setView(view, materialId = null) {
  state.currentView = view;
  state.currentMaterial = materialId;
  render();
}

function openMaterial(materialId) {
  state.currentMaterial = materialId;
  state.currentView = 'material';
  render();
}

function openSummary(materialId) {
  state.currentMaterial = materialId;
  state.currentView = 'summary';
  render();
}

function openQuiz(materialId) {
  const material = getMaterialState(materialId);
  if (!material.summaryDone && !material.quizCompleted) {
    notify('Latihan belum dibuka. Selesaikan rangkuman terlebih dahulu.', 'warning');
    return;
  }

  state.currentMaterial = materialId;
  state.currentView = 'quiz';
  material.quizStarted = true;
  saveState();
  render();
}

function openResults(materialId) {
  state.currentMaterial = materialId;
  state.currentView = 'results';
  render();
}

function openDiscussion(materialId) {
  const material = getMaterialState(materialId);
  material.discussionOpened = true;
  state.currentMaterial = materialId;
  state.currentView = 'discussion';
  saveState();
  render();
}

function notify(message, type = 'success') {
  const app = document.querySelector('#app');
  if (!app) return;

  const existing = app.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `notice notice-${type} toast`;
  toast.textContent = message;
  app.prepend(toast);

  setTimeout(() => toast.remove(), 2500);
}

function recordMaterialCompletion(materialId) {
  const material = getMaterialState(materialId);
  material.summaryDone = true;
  material.quizStarted = false;
  material.lastAccessed = new Date().toISOString();
  saveState();
  notify('Latihan untuk materi ini sudah terbuka.', 'success');
  openMaterial(materialId);
}

function markSummaryDone(materialId) {
  const material = getMaterialState(materialId);
  material.summaryDone = true;
  material.quizStarted = false;
  material.lastAccessed = new Date().toISOString();
  saveState();
  notify('Selamat! Anda sudah memahami materi ini. Latihan sekarang terbuka.', 'success');
  openMaterial(materialId);
}

function updateAnswer(materialId, questionNumber, value) {
  const material = getMaterialState(materialId);
  material.answers[questionNumber] = value;
  material.quizStarted = true;
  saveState();
  render();
}

function getSubmissionSummary(materialId) {
  const material = getMaterialState(materialId);
  const questions = getQuestionBank(materialId);
  let answered = 0;
  let empty = 0;

  for (let index = 0; index < questions.length; index += 1) {
    const key = String(index + 1);
    if (material.answers[key]) {
      answered += 1;
    } else {
      empty += 1;
    }
  }

  return {
    answered,
    empty,
    total: questions.length,
    unanswered: questions.length - answered
  };
}

function submitQuiz(materialId) {
  const material = getMaterialState(materialId);
  const questions = getQuestionBank(materialId);
  const summary = getSubmissionSummary(materialId);

  if (summary.answered + summary.empty !== questions.length) {
    return;
  }

  let correct = 0;
  let wrong = 0;
  let empty = 0;

  for (let i = 0; i < questions.length; i += 1) {
    const key = String(i + 1);
    const selected = material.answers[key];
    if (!selected) {
      empty += 1;
      continue;
    }

    if (selected === questions[i].answer) {
      correct += 1;
    } else {
      wrong += 1;
    }
  }

  const score = Math.round((correct / questions.length) * 100);
  material.latestResult = {
    correct,
    wrong,
    empty,
    score,
    submittedAt: new Date().toISOString()
  };
  material.quizCompleted = true;
  material.quizStarted = false;
  material.lastResultAt = new Date().toISOString();
  saveState();
  openResults(materialId);
}

function resetProgress() {
  const confirmed = window.confirm('Apakah Anda yakin ingin menghapus semua progres belajar pada aplikasi ini?');
  if (!confirmed) return;

  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  render();
  notify('Progress telah direset.', 'success');
}

function getMaterialDocs(materialId) {
  const definitions = {
    grammar: [
      'Past Perfect Tense',
      'Passive Voice',
      'Question Tags',
      'Finding Errors',
      'Subject-verb agreement',
      'Prepositions, articles, and conjunctions'
    ],
    reading: [
      'Main idea and purpose',
      'Explicit and implicit details',
      'Vocabulary in context',
      'Reference words',
      'Sequence and cause-effect'
    ],
    tenses: [
      'Simple Present and Present Continuous',
      'Past Simple and Past Continuous',
      'Present Perfect and Past Perfect',
      'Future forms and time signals',
      'Choosing the best tense in context'
    ],
    'general-knowledge': [
      'Geography and culture',
      'Science and environment',
      'History and famous people',
      'International organizations',
      'Data literacy and current issues'
    ]
  };

  return definitions[materialId] || [];
}

function getSelectedOptionText(options, selectedLetter) {
  if (!selectedLetter || !options || !options.length) return 'Kosong';
  const idx = ['A', 'B', 'C', 'D'].indexOf(selectedLetter);
  if (idx === -1) return 'Kosong';
  return options[idx];
}

function renderHome() {
  const overall = getOverallProgress();
  const html = `
    <div class="app-shell">
      <header class="topbar">
        <h1>Mathlete English Olympiad Prep -- Grade 6</h1>
        <button class="btn reset-button" data-action="reset-progress">Reset Progres</button>
      </header>
      <div class="page-inner">
        <div class="description-box">
          <p>
            Selamat datang! Pilih satu materi di bawah ini dan ikuti alur belajar: baca rangkuman,
            tandai bahwa Anda sudah paham, lalu kerjakan 50 soal pilihan ganda. Semua progres tersimpan secara otomatis di perangkat Anda.
          </p>
        </div>

        <div class="section-title">
          <h2>Materi utama</h2>
          <div class="badge status-complete">Progress keseluruhan: ${overall}%</div>
        </div>

        <div class="progress-wrap" style="margin-bottom:18px;">
          <div class="progress-meta">
            <span>Progress keseluruhan</span>
            <span>${overall}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${overall}%"></div>
          </div>
        </div>

        <div class="material-grid">
          ${allMaterials.map((materialId) => {
            const material = getMaterialState(materialId);
            const status = getStatusText(materialId);
            const progress = getProgressValue(materialId);
            const statusClass = status === 'Belum dimulai'
              ? 'status-not-started'
              : status === 'Sedang dipelajari'
                ? 'status-learning'
                : status === 'Materi selesai'
                  ? 'status-finished'
                  : 'status-complete';

            return `
              <article class="material-card">
                <div class="badge ${statusClass}">${status}</div>
                <h3>${materialMeta[materialId].name}</h3>
                <div class="progress-wrap">
                  <div class="progress-meta">
                    <span>Progress</span>
                    <span>${Math.round(progress)}%</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" style="width:${progress}%"></div>
                  </div>
                </div>
                <div class="card-actions">
                  <button class="btn btn-primary" data-action="open-material" data-material-id="${materialId}">Buka</button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  document.querySelector('#app').innerHTML = html;
}

function renderMaterialMenu() {
  const materialId = state.currentMaterial;
  const material = getMaterialState(materialId);
  const docs = getMaterialDocs(materialId);

  const html = `
    <div class="app-shell">
      <header class="topbar">
        <h1>${materialMeta[materialId].name}</h1>
        <button class="btn reset-button" data-action="go-home">Kembali ke Menu</button>
      </header>
      <div class="page-inner">
        <div class="breadcrumb">
          <span>Home</span>
          <span class="sep">/</span>
          <span>${materialMeta[materialId].name}</span>
        </div>

        <div class="panel">
          <div class="section-title">
            <h2>Submenu materi</h2>
            <span class="badge ${
              getStatusText(materialId) === 'Belum dimulai'
                ? 'status-not-started'
                : getStatusText(materialId) === 'Sedang dipelajari'
                  ? 'status-learning'
                  : getStatusText(materialId) === 'Materi selesai'
                    ? 'status-finished'
                    : 'status-complete'
            }">${getStatusText(materialId)}</span>
          </div>

          <div class="mini-grid">
            <div class="info-box">
              <h4>Tujuan belajar</h4>
              <p>Siswa akan memahami konsep, menerapkan strategi, dan menyelesaikan soal dengan teliti dan logis.</p>
            </div>
            <div class="info-box">
              <h4>Area utama</h4>
              <ul>
                ${docs.map((item) => `<li>${item}</li>`).join('')}
              </ul>
            </div>
          </div>

          <div class="card-actions">
            <button class="btn btn-primary" data-action="open-summary" data-material-id="${materialId}">Penjelasan Materi / Rangkuman</button>
            <button class="btn btn-secondary" data-action="open-quiz" data-material-id="${materialId}" ${!material.summaryDone && !material.quizCompleted ? 'disabled' : ''}>Soal-soal Latihan</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#app').innerHTML = html;
}

function renderSummary() {
  const materialId = state.currentMaterial;
  const material = getMaterialState(materialId);
  const bank = getQuestionBank(materialId);
  const summaryTitle = materialMeta[materialId].name;

  const summaryContent = {
    grammar: `
      <h2>Advanced Grammar</h2>
      <p>Grammar dalam olimpiade tidak hanya tentang menghafal aturan, tetapi tentang melihat konteks dan memilih bentuk yang paling tepat. Dalam soal kelas 6, kalian sering akan menemukan kombinasi tense, agreement, passive voice, dan tanda tanya.</p>
      <h3>1. Past Perfect Tense</h3>
      <p>Past Perfect digunakan untuk menyatakan kejadian yang selesai sebelum kejadian lain di masa lalu. Polanya adalah <strong>had + past participle</strong>.</p>
      <div class="example-box">Before the bell rang, the students had finished the quiz.</div>
      <p>Dalam kalimat ini, tindakan <em>had finished</em> terjadi terlebih dahulu. Keterangan seperti <em>before</em>, <em>by the time</em>, dan <em>after</em> biasanya membantu kita menentukan urutan kejadian.</p>
      <h3>2. Passive Voice</h3>
      <p>Passive voice menekankan objek dan hasil tindakan, bukan pelaku. Pola umum adalah <strong>be + past participle</strong>.</p>
      <div class="example-box">The cake was baked by my mother.</div>
      <p>Pelaku bisa ditulis setelah <em>by</em> jika penting. Namun, dalam soal pilihan ganda, sering kali yang paling tepat adalah bentuk pasif yang sesuai dengan waktu kalimat.</p>
      <h3>3. Question Tags</h3>
      <p>Question tag adalah pertanyaan pendek yang ditambahkan di akhir pernyataan. Bentuk tag sesuai dengan auxiliary atau kata kerja bantu dalam kalimat utama.</p>
      <div class="example-box">You are ready, aren't you?</div>
      <p>Jika kalimat positif, tag biasanya negatif. Jika kalimat negatif, tag biasanya positif.</p>
      <h3>4. Finding Errors</h3>
      <p>Dalam soal <em>error recognition</em>, fokuskan bagian yang salah: subjek, kata kerja, artikel, preposisi, atau bentuk tense. Jangan hanya melihat panjang kalimat; cari bagian yang tidak konsisten dengan pola.</p>
      <h3>5. Tips penting</h3>
      <ul>
        <li>Perhatikan urutan waktu: masa lalu sebelum masa lalu, gunakan past perfect.</li>
        <li>Pastikan subjek dan kata kerja sama dalam jumlah (singular/plural).</li>
        <li>Gunakan kata kerja bantu dengan benar dalam kalimat negatif dan pertanyaan.</li>
        <li>Lihat kata kunci seperti <em>before, after, by the time, until</em>.</li>
      </ul>
    `,
    tenses: `
      <h2>Tenses</h2>
      <p>Tenses membantu kita menyampaikan waktu kejadian dengan jelas. Dalam bahasa Inggris, waktu dan bentuk kata kerja harus sesuai dengan konteks. Jika kita tahu kapan kejadian itu terjadi, maka kita dapat memilih bentuk yang benar.</p>
      <h3>1. Simple Present</h3>
      <p>Simple Present digunakan untuk kebiasaan, fakta, dan jadwal yang terjadi berulang.</p>
      <div class="example-box">The sun rises in the east. / I walk to school every day.</div>
      <p>Untuk subjek tunggal, biasanya ditambah <em>-s</em> atau <em>-es</em>.</p>
      <h3>2. Present Continuous</h3>
      <p>Present Continuous digunakan untuk kegiatan yang sedang terjadi sekarang atau saat ini.</p>
      <div class="example-box">She is reading a book right now.</div>
      <p>Pola: <strong>am/is/are + verb-ing</strong>.</p>
      <h3>3. Simple Past</h3>
      <p>Simple Past dipakai untuk kejadian yang sudah selesai di masa lalu.</p>
      <div class="example-box">We visited the museum last weekend.</div>
      <p>Kata kunci: <em>yesterday, last week, two days ago, in 2020</em>.</p>
      <h3>4. Past Continuous</h3>
      <p>Past Continuous digunakan untuk kegiatan yang sedang berlangsung pada saat kejadian lain terjadi di masa lalu.</p>
      <div class="example-box">While I was studying, my brother called me.</div>
      <p>Pola: <strong>was/were + verb-ing</strong>.</p>
      <h3>5. Present Perfect</h3>
      <p>Present Perfect menunjukkan kejadian yang terjadi di masa lalu tetapi masih berhubungan dengan sekarang.</p>
      <div class="example-box">I have finished my homework.</div>
      <p>Kata kunci: <em>already, just, yet, ever, never, since, for</em>.</p>
      <h3>6. Past Perfect</h3>
      <p>Past Perfect menggambarkan kejadian yang selesai sebelum kejadian lain di masa lalu.</p>
      <div class="example-box">By the time we arrived, the train had left.</div>
      <p>Pola: <strong>had + past participle</strong>.</p>
      <h3>7. Simple Future</h3>
      <p>Simple Future digunakan untuk rencana, prediksi, atau keputusan di masa depan.</p>
      <div class="example-box">I will join the science club next month.</div>
      <p>Pola: <strong>will + base verb</strong>.</p>
      <h3>8. Tips memilih tenses</h3>
      <ul>
        <li>Perhatikan kata kunci waktu.</li>
        <li>Perhatikan urutan kejadian.</li>
        <li>Jika ada dua kegiatan di masa lalu, gunakan past continuous atau past perfect sesuai urutan.</li>
        <li>Untuk kegiatan yang sedang berlangsung sekarang, pilih present continuous.</li>
      </ul>
    `,
    reading: `
      <h2>Reading Comprehension</h2>
      <p>Soal membaca menilai kemampuan memahami teks, bukan hanya kecepatan membaca. Siswa harus menemukan ide utama, detail yang jelas, informasi tersirat, hubungan sebab-akibat, serta arti kata dalam konteks.</p>
      <h3>1. Ide utama</h3>
      <p>Ide utama adalah gagasan paling penting yang dibahas dalam teks. Biasanya ada di kalimat pertama, tetapi kadang juga muncul di seluruh paragraf. Coba tanyakan: <em>Topik utama teks ini tentang apa?</em></p>
      <div class="example-box">The text explains how a school garden helps students learn responsibility and teamwork.</div>
      <p>Pilihan yang paling tepat akan mencerminkan inti keseluruhan teks, bukan hanya satu detail kecil.</p>
      <h3>2. Informasi tersurat</h3>
      <p>Informasi tersurat adalah fakta yang tertulis jelas di dalam teks. Jawaban biasanya dapat ditemukan langsung tanpa menebak.</p>
      <div class="example-box">The writer says that the festival began at 8 a.m.</div>
      <p>Jawaban yang benar biasanya sesuai dengan detail teks, bukan kesimpulan yang terlalu luas.</p>
      <h3>3. Inferensi dan makna kata dalam konteks</h3>
      <p>Inferensi berarti menarik kesimpulan yang tidak disebutkan secara langsung. Kita biasanya melihat bukti di teks dan menghubungkannya.</p>
      <div class="example-box">The room was quiet, and the children spoke in whispers.</div>
      <p>Dari konteks, dapat disimpulkan bahwa mereka ingin tidak mengganggu orang lain.</p>
      <h3>4. Rujukan kata ganti</h3>
      <p>Kata ganti seperti <em>he, she, it, they, this, those</em> sering menggantikan kata benda yang telah disebut. Cari benda yang paling dekat dan sesuai.</p>
      <h3>5. Urutan kejadian</h3>
      <p>Untuk soal urutan, baca kejadian dari awal hingga akhir. Perhatikan kata penghubung seperti <em>first, then, after that, finally</em>.</p>
      <h3>6. Strategi membaca</h3>
      <ul>
        <li>Baca judul dan kalimat pertama paragraf untuk membangun gambaran umum.</li>
        <li>Temukan kata kunci di pertanyaan.</li>
        <li>Cari jawaban yang spesifik dan dibuktikan teks.</li>
      </ul>
    `,
    'general-knowledge': `
      <h2>General Knowledge in English</h2>
      <p>Pengetahuan umum melatih siswa untuk memahami dunia di sekitar mereka. Soal-soal ini mencakup geografi, budaya, sains dasar, sejarah, dan informasi global yang disajikan dalam bahasa Inggris.</p>
      <h3>1. Geografi</h3>
      <p>Kenali benua, samudra, negara, dan ibu kota. Contoh: Indonesia terletak di Asia Tenggara dan berbatasan dengan Samudra Hindia dan Pasifik.</p>
      <div class="example-box">The capital city of Japan is Tokyo.</div>
      <p>Jangan hanya menghafal nama, pahami hubungan antarwilayah dan karakteristik utama.</p>
      <h3>2. Sains dan lingkungan</h3>
      <p>Lingkungan hidup, siklus air, dan bentuk tubuh makhluk hidup sering muncul dalam soal. Cermati fakta dasar seperti air menguap saat dipanaskan, dan tumbuhan menghasilkan makanan melalui fotosintesis.</p>
      <h3>3. Budaya dan organisasi internasional</h3>
      <p>Tahu nama organisasi seperti UNESCO, WHO, dan ASEAN serta tujuan dasarnya. Fokus pada fungsi utama, bukan hanya singkatan.</p>
      <h3>4. Literasi informasi</h3>
      <p>Beberapa soal menyajikan tabel, jadwal, atau pernyataan singkat. Baca data dengan teliti, lalu bandingkan satu informasi dengan informasi lainnya.</p>
      <h3>5. Tips saat menjawab</h3>
      <ul>
        <li>Hati-hati dengan pilihan yang terdengar benar tetapi tidak tepat.</li>
        <li>Jika ada data, baca label, judul, dan angka dengan teliti.</li>
        <li>Untuk soal sejarah atau tokoh, cari hubungan sebab-akibat dan peran mereka.</li>
      </ul>
    `
  };

  const checklist = {
    grammar: [
      'Saya dapat membedakan penggunaan Past Perfect dan tenses lain.',
      'Saya paham pola Passive Voice dalam kalimat sederhana.',
      'Saya bisa memilih question tag yang tepat.',
      'Saya dapat menemukan bagian kalimat yang salah.'
    ],
    reading: [
      'Saya dapat menemukan ide utama dari sebuah teks.',
      'Saya bisa menjawab pertanyaan berdasarkan informasi yang jelas di teks.',
      'Saya dapat menebak arti kata dari konteks.',
      'Saya dapat mengurutkan kejadian dan memeriksa rujukan kata ganti.'
    ],
    tenses: [
      'Saya dapat membedakan simple present, present continuous, dan present perfect.',
      'Saya paham kapan harus memakai simple past dan past continuous.',
      'Saya dapat memilih bentuk future yang tepat untuk rencana atau prediksi.',
      'Saya tahu cara membaca kata kunci waktu seperti yesterday, yet, since, dan by the time.'
    ],
    'general-knowledge': [
      'Saya memahami fakta dasar geografi, budaya, dan sains.',
      'Saya dapat membaca data singkat atau jadwal dengan benar.',
      'Saya bisa membedakan informasi utama dari pilihan yang mengelabui.',
      'Saya tahu fungsi dasar organisasi internasional dan tokoh penting.'
    ]
  };

  const html = `
    <div class="app-shell">
      <header class="topbar">
        <h1>${summaryTitle}</h1>
        <button class="btn reset-button" data-action="go-home">Kembali ke Menu</button>
      </header>
      <div class="page-inner summary-content">
        <div class="breadcrumb">
          <span>Home</span>
          <span class="sep">/</span>
          <span>${summaryTitle}</span>
          <span class="sep">/</span>
          <span>Rangkuman</span>
        </div>

        <div class="summary-card">
          <div class="section-title">
            <h2>Tujuan belajar</h2>
          </div>
          <div class="mini-grid">
            <div class="info-box">
              <h4>Setelah mempelajari materi ini, siswa mampu:</h4>
              <ul>
                <li>Memahami pola dan aturan utama dengan lebih yakin.</li>
                <li>Menerapkan strategi menjawab soal pilihan ganda dengan tepat.</li>
                <li>Menemukan jawaban yang benar dari konteks, bukti, dan logika.</li>
              </ul>
            </div>
          </div>
        </div>

        ${summaryContent[materialId] || ''}

        <div class="summary-card">
          <h3>Checklist pemahaman</h3>
          <div class="checklist">
            ${checklist[materialId].map((item) => `
              <label class="checklist-item">
                <input type="checkbox" />
                <span>${item}</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="card-actions">
          <button class="btn btn-success" data-action="mark-summary-done" data-material-id="${materialId}">Saya sudah memahami materi ini</button>
          <button class="btn btn-secondary" data-action="open-material" data-material-id="${materialId}">Kembali ke menu</button>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#app').innerHTML = html;
}

function renderQuiz() {
  const materialId = state.currentMaterial;
  const material = getMaterialState(materialId);
  const questions = getQuestionBank(materialId);
  const currentIndex = Number(state.currentQuestionIndex || 0);
  const currentQuestion = questions[currentIndex];
  const answered = material.answers[String(currentIndex + 1)] || '';

  const progress = Math.round(((currentIndex + 1) / questions.length) * 100);

  const html = `
    <div class="app-shell">
      <header class="topbar">
        <h1>${materialMeta[materialId].name}</h1>
        <button class="btn reset-button" data-action="go-home">Menu utama</button>
      </header>
      <div class="page-inner">
        <div class="quiz-header">
          <div>
            <div class="question-status">Question ${currentIndex + 1} of ${questions.length}</div>
          </div>
          <div class="badge status-learning">Progress latihan: ${progress}%</div>
        </div>

        <div class="progress-wrap">
          <div class="progress-meta">
            <span>Progress</span>
            <span>${progress}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>
        </div>

        <div class="question-panel" style="margin-top: 18px;">
          <h2>${currentQuestion.question}</h2>
          <ul class="option-list">
            ${currentQuestion.options.map((option, idx) => {
              const letter = ['A', 'B', 'C', 'D'][idx];
              const isSelected = answered === letter;
              return `
                <li>
                  <label class="option-label ${isSelected ? 'selected' : ''}">
                    <input type="radio" name="answer-${currentIndex}" value="${letter}" ${isSelected ? 'checked' : ''} data-action="select-answer" data-material-id="${materialId}" data-question-index="${currentIndex + 1}" />
                    <span><strong>${letter}.</strong> ${option}</span>
                  </label>
                </li>
              `;
            }).join('')}
          </ul>
        </div>

        <div class="nav-dot-grid">
          ${questions.map((_, idx) => {
            const key = String(idx + 1);
            const chosen = material.answers[key];
            const classes = ['nav-dot'];
            if (idx === currentIndex) classes.push('current');
            if (chosen) classes.push('answered');
            return `<button class="${classes.join(' ')}" data-action="jump-to-question" data-material-id="${materialId}" data-question-index="${idx + 1}">${idx + 1}</button>`;
          }).join('')}
        </div>

        <div class="quiz-footer">
          <div class="card-actions">
            <button class="btn btn-secondary" data-action="prev-question" data-material-id="${materialId}" ${currentIndex === 0 ? 'disabled' : ''}>Sebelumnya</button>
            <button class="btn btn-primary" data-action="next-question" data-material-id="${materialId}" ${currentIndex === questions.length - 1 ? 'disabled' : ''}>Berikutnya</button>
          </div>

          <button class="btn btn-success" data-action="submit-quiz" data-material-id="${materialId}">Selesaikan Latihan</button>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#app').innerHTML = html;
}

function renderResults() {
  const materialId = state.currentMaterial;
  const material = getMaterialState(materialId);
  const result = material.latestResult;
  const summary = getSubmissionSummary(materialId);

  const html = `
    <div class="app-shell">
      <header class="topbar">
        <h1>Hasil Latihan</h1>
        <button class="btn reset-button" data-action="open-material" data-material-id="${materialId}">Kembali ke menu</button>
      </header>
      <div class="page-inner">
        <div class="results-panel">
          <div class="section-title">
            <h2>${materialMeta[materialId].name}</h2>
          </div>

          <div class="stat-grid">
            <div class="stat-box correct">
              <span>Jawaban benar</span>
              <strong>${result.correct}</strong>
            </div>
            <div class="stat-box wrong">
              <span>Jawaban salah</span>
              <strong>${result.wrong}</strong>
            </div>
            <div class="stat-box empty">
              <span>Soal kosong</span>
              <strong>${result.empty}</strong>
            </div>
            <div class="stat-box">
              <span>Nilai</span>
              <strong>${result.score}/100</strong>
            </div>
          </div>

          <div class="notice notice-success">Skor Anda dihitung dengan rumus: jumlah jawaban benar / 50 × 100.</div>

          <div class="card-actions" style="margin-top: 18px;">
            <button class="btn btn-primary" data-action="view-discussion" data-material-id="${materialId}">Lihat Pembahasan Soal</button>
            <button class="btn btn-secondary" data-action="open-material" data-material-id="${materialId}">Kembali ke Menu Materi</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.querySelector('#app').innerHTML = html;
}

function renderDiscussion() {
  const materialId = state.currentMaterial;
  const questions = getQuestionBank(materialId);
  const material = getMaterialState(materialId);
  const filter = state.discussionFilter || 'all';

  const getStatusClass = (selectedValue, correctAnswer) => {
    if (!selectedValue) return 'empty';
    return selectedValue === correctAnswer ? 'correct' : 'wrong';
  };

  const filteredQuestions = questions.filter((question, index) => {
    const selectedValue = material.answers[String(index + 1)];
    const status = !selectedValue ? 'empty' : selectedValue === question.answer ? 'correct' : 'wrong';
    if (filter === 'all') return true;
    if (filter === 'wrong') return status === 'wrong';
    if (filter === 'empty') return status === 'empty';
    if (filter === 'correct') return status === 'correct';
    return true;
  });

  const html = `
    <div class="app-shell">
      <header class="topbar">
        <h1>Pembahasan Soal</h1>
        <button class="btn reset-button" data-action="open-material" data-material-id="${materialId}">Menu materi</button>
      </header>
      <div class="page-inner">
        <div class="discussion-panel">
          <div class="section-title">
            <h2>${materialMeta[materialId].name}</h2>
            <button class="btn btn-secondary" data-action="open-results" data-material-id="${materialId}">Kembali ke Hasil Latihan</button>
          </div>

          <div class="filter-row">
            ${['all', 'wrong', 'empty', 'correct'].map((key) => `
              <button class="filter-btn ${filter === key ? 'active' : ''}" data-action="set-discussion-filter" data-filter="${key}" data-material-id="${materialId}">${
                key === 'all' ? 'Semua soal' :
                key === 'wrong' ? 'Jawaban salah' :
                key === 'empty' ? 'Soal kosong' : 'Jawaban benar'
              }</button>
            `).join('')}
          </div>

          ${filteredQuestions.map((question, index) => {
            const actualIndex = questions.indexOf(question) + 1;
            const selectedValue = material.answers[String(actualIndex)] || '';
            const status = !selectedValue ? 'empty' : selectedValue === question.answer ? 'correct' : 'wrong';
            const statusText = status === 'correct' ? 'benar' : status === 'wrong' ? 'salah' : 'kosong';
            const chosenText = selectedValue ? getSelectedOptionText(question.options, selectedValue) : 'Tidak dijawab';
            return `
              <article class="discussion-item">
                <div class="question-head">
                  <h3>Nomor ${actualIndex}</h3>
                  <span class="badge-status ${status}">${statusText}</span>
                </div>
                <p><strong>Pertanyaan:</strong> ${question.question}</p>
                <table class="answer-table">
                  <tr>
                    <th>A</th>
                    <td>${question.options[0]}</td>
                  </tr>
                  <tr>
                    <th>B</th>
                    <td>${question.options[1]}</td>
                  </tr>
                  <tr>
                    <th>C</th>
                    <td>${question.options[2]}</td>
                  </tr>
                  <tr>
                    <th>D</th>
                    <td>${question.options[3]}</td>
                  </tr>
                </table>
                <p><strong>Jawaban siswa:</strong> ${chosenText}</p>
                <p><strong>Kunci jawaban:</strong> ${question.answer}. ${question.options[['A', 'B', 'C', 'D'].indexOf(question.answer)]}</p>
                <p><strong>Status:</strong> ${statusText}</p>
                <p><strong>Pembahasan:</strong> ${question.explanation}</p>
              </article>
            `;
          }).join('') || '<div class="notice notice-warning">Tidak ada soal dalam filter ini.</div>'}
        </div>
      </div>
    </div>
  `;

  document.querySelector('#app').innerHTML = html;
}

function render() {
  const view = state.currentView || 'home';

  if (view === 'home') {
    renderHome();
    return;
  }

  if (view === 'material') {
    renderMaterialMenu();
    return;
  }

  if (view === 'summary') {
    renderSummary();
    return;
  }

  if (view === 'quiz') {
    if (!state.currentMaterial) {
      setView('home');
      return;
    }

    renderQuiz();
    return;
  }

  if (view === 'results') {
    renderResults();
    return;
  }

  if (view === 'discussion') {
    renderDiscussion();
    return;
  }

  renderHome();
}

function renderQuestionAfterSelection(materialId, questionNumber) {
  const material = getMaterialState(materialId);
  const questions = getQuestionBank(materialId);
  const currentQuestionIndex = Number(questionNumber) - 1;
  state.currentQuestionIndex = currentQuestionIndex;
  material.quizStarted = true;
  saveState();
  render();
}

function handleAction(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const materialId = target.dataset.materialId;

  switch (action) {
    case 'go-home':
      setView('home');
      break;
    case 'open-material':
      openMaterial(materialId);
      break;
    case 'open-summary':
      state.currentQuestionIndex = 0;
      openSummary(materialId);
      break;
    case 'open-quiz':
      state.currentQuestionIndex = 0;
      openQuiz(materialId);
      break;
    case 'mark-summary-done':
      markSummaryDone(materialId);
      break;
    case 'select-answer': {
      const questionNumber = Number(target.dataset.questionIndex || 1);
      const value = target.value;
      updateAnswer(materialId, questionNumber, value);
      break;
    }
    case 'prev-question': {
      const nextIndex = Math.max(0, (state.currentQuestionIndex || 0) - 1);
      state.currentQuestionIndex = nextIndex;
      render();
      break;
    }
    case 'next-question': {
      const maxIndex = getQuestionBank(materialId).length - 1;
      const nextIndex = Math.min(maxIndex, (state.currentQuestionIndex || 0) + 1);
      state.currentQuestionIndex = nextIndex;
      render();
      break;
    }
    case 'jump-to-question': {
      state.currentQuestionIndex = Number(target.dataset.questionIndex || 1) - 1;
      render();
      break;
    }
    case 'submit-quiz': {
      const material = getMaterialState(materialId);
      const summary = getSubmissionSummary(materialId);
      const unanswered = summary.empty;

      if (unanswered > 0) {
        const confirmed = window.confirm(`Ada ${unanswered} soal yang masih kosong. Soal kosong akan dihitung salah. Apakah Anda yakin ingin menyelesaikan latihan?`);
        if (!confirmed) return;
      }

      submitQuiz(materialId);
      break;
    }
    case 'view-discussion':
      state.discussionFilter = 'all';
      openDiscussion(materialId);
      break;
    case 'open-results':
      openResults(materialId);
      break;
    case 'set-discussion-filter': {
      state.discussionFilter = target.dataset.filter;
      renderDiscussion();
      break;
    }
    case 'reset-progress':
      resetProgress();
      break;
    default:
      break;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  if (!state.currentMaterial) {
    state.currentView = 'home';
  }

  if (!state.currentQuestionIndex) {
    state.currentQuestionIndex = 0;
  }

  document.addEventListener('click', handleAction);
  render();
});
