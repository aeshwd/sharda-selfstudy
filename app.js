import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ==========================================
// CONFIGURATION (Replace with your Supabase credentials)
// ==========================================
const SUPABASE_URL = 'https://vmnjmdxxhvzwqselmune.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ACTUAL_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    initSplash();
    initAuthTabs();
    initAuthForms();
    
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await handleAuthSession(session.user);
    } else {
        showAuthView();
    }
});

function initSplash() {
    const splash = document.getElementById('splash-screen');
    const enterBtn = document.getElementById('enter-portal-btn');
    const loader = document.querySelector('.splash-loader');

    setTimeout(() => {
        loader.style.display = 'none';
        enterBtn.style.display = 'inline-flex';
    }, 1500);

    enterBtn.addEventListener('click', () => {
        splash.style.opacity = '0';
        setTimeout(() => splash.remove(), 400);
    });
}

function initAuthTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.tab === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
            } else {
                loginForm.classList.add('hidden');
                registerForm.classList.remove('hidden');
            }
            clearAlerts();
        });
    });
}

function initAuthForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        showAuthAlert('Signing in...', 'success');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) showAuthAlert(error.message, 'error');
        else {
            showToast('Successfully logged in!', 'success');
            await handleAuthSession(data.user);
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-fullname').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const dob = document.getElementById('reg-dob').value;
        const password = document.getElementById('reg-password').value;

        showAuthAlert('Creating student account...', 'success');
        const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { data: { full_name: fullName, dob: dob } }
        });

        if (error) showAuthAlert(error.message, 'error');
        else {
            showAuthAlert('Registration successful! Awaiting admin approval.', 'success');
            registerForm.reset();
        }
    });

    document.getElementById('forgot-password-link').addEventListener('click', async (e) => {
        e.preventDefault();
        const email = prompt('Enter your registered email:');
        if (!email) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) showToast(error.message, 'error');
        else showToast('Password reset link sent to your email.', 'success');
    });
}

async function handleAuthSession(user) {
    currentUser = user;
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();

    if (error || !profile) {
        showAuthAlert('Profile not found. Contact administrator.', 'error');
        await supabase.auth.signOut();
        return;
    }

    currentProfile = profile;

    if (profile.role === 'student' && profile.status !== 'active') {
        await supabase.auth.signOut();
        showAuthAlert(`Your account is currently ${profile.status}. Await admin approval.`, 'error');
        showAuthView();
        return;
    }

    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');

    renderNavigation();
    loadDashboardView();
}

function renderNavigation() {
    const navContainer = document.getElementById('bottom-nav-links');
    navContainer.innerHTML = '';

    const role = currentProfile.role;
    let links = role === 'admin' ? [
        { id: 'admin-dash', label: 'Home', icon: '📊' },
        { id: 'admin-students', label: 'Students', icon: '🎓' },
        { id: 'admin-tests', label: 'Tests', icon: '📝' },
        { id: 'admin-attendance', label: 'Attendance', icon: '📅' },
        { id: 'admin-approvals', label: 'Approvals', icon: '⏳' }
    ] : [
        { id: 'student-dash', label: 'Home', icon: '🏠' },
        { id: 'student-tests', label: 'Results', icon: '📊' },
        { id: 'student-attendance', label: 'Attendance', icon: '📅' },
        { id: 'student-profile', label: 'Profile', icon: '⚙️' }
    ];

    links.forEach((link, idx) => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = `app-nav-item ${idx === 0 ? 'active' : ''}`;
        a.innerHTML = `<span>${link.icon}</span><span>${link.label}</span>`;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.app-nav-item').forEach(el => el.classList.remove('active'));
            a.classList.add('active');
            document.getElementById('app-screen-title').textContent = link.label;
            switchView(link.id);
        });
        navContainer.appendChild(a);
    });

    document.getElementById('app-user-greeting').textContent = currentProfile.full_name || 'User';
    const topAvatar = document.getElementById('topbar-avatar');
    if (currentProfile.avatar_path) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(currentProfile.avatar_path);
        topAvatar.innerHTML = `<img src="${data.publicUrl}" alt="Avatar">`;
    } else {
        topAvatar.textContent = currentProfile.full_name ? currentProfile.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'SS';
    }

    document.getElementById('logout-btn-top').onclick = async () => {
        await supabase.auth.signOut();
        currentUser = null;
        currentProfile = null;
        showAuthView();
        showToast('Logged out successfully', 'success');
    };
}

function switchView(viewId) {
    const contentEl = document.getElementById('dashboard-content');
    contentEl.innerHTML = '<div class="text-muted" style="text-align:center; padding:3rem;">Loading...</div>';

    if (currentProfile.role === 'admin') {
        if (viewId === 'admin-dash') renderAdminDashboard(contentEl);
        else if (viewId === 'admin-students') renderAdminStudents(contentEl);
        else if (viewId === 'admin-tests') renderAdminTests(contentEl);
        else if (viewId === 'admin-attendance') renderAdminAttendance(contentEl);
        else if (viewId === 'admin-approvals') renderAdminApprovals(contentEl);
    } else {
        if (viewId === 'student-dash') renderStudentDashboard(contentEl);
        else if (viewId === 'student-tests') renderStudentTests(contentEl);
        else if (viewId === 'student-attendance') renderStudentAttendance(contentEl);
        else if (viewId === 'student-profile') renderStudentProfile(contentEl);
    }
}

function loadDashboardView() {
    switchView(currentProfile.role === 'admin' ? 'admin-dash' : 'student-dash');
}

// ================= ADMIN VIEWS =================
async function renderAdminDashboard(container) {
    const [{ count: totalStudents }, { count: pendingStudents }, { count: totalTests }, { data: testResults }, { data: attendance }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'pending'),
        supabase.from('tests').select('*', { count: 'exact', head: true }),
        supabase.from('test_results').select('marks_obtained, maximum_marks'),
        supabase.from('attendance_records').select('status')
    ]);

    let totalObtained = 0, totalMax = 0;
    (testResults || []).forEach(r => { totalObtained += Number(r.marks_obtained); totalMax += Number(r.maximum_marks); });
    const overallPct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : 'N/A';

    const validAtt = (attendance || []).filter(a => a.status === 'present' || a.status === 'absent');
    const presentCount = validAtt.filter(a => a.status === 'present').length;
    const attendancePct = validAtt.length > 0 ? ((presentCount / validAtt.length) * 100).toFixed(2) : 'Not available';

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><h4>Students</h4><div class="stat-value">${totalStudents || 0}</div></div>
            <div class="stat-card"><h4>Pending</h4><div class="stat-value" style="color:var(--warning);">${pendingStudents || 0}</div></div>
            <div class="stat-card"><h4>Tests</h4><div class="stat-value">${totalTests || 0}</div></div>
            <div class="stat-card"><h4>Performance</h4><div class="stat-value">${overallPct === 'N/A' ? 'N/A' : overallPct + '%'}</div></div>
        </div>
        <div class="table-container">
            <div class="table-header-action"><h3>System Overview</h3></div>
            <div style="padding:1.25rem;"><p class="text-muted">Use the bottom navigation bar to manage students, tests, attendance, and approvals instantly.</p></div>
        </div>
    `;
}

async function renderAdminStudents(container) {
    const { data: students } = await supabase.from('profiles').select('*').eq('role', 'student');
    container.innerHTML = `
        <div class="table-container">
            <div class="table-header-action">
                <h3>Students (${students?.length || 0})</h3>
                <input type="text" id="student-search" class="table-search" placeholder="Search...">
            </div>
            <div class="table-responsive">
                <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody id="students-tbody">
                        ${(students || []).map(s => `
                            <tr>
                                <td>${s.full_name}</td>
                                <td>${s.email}</td>
                                <td><span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-warning'}">${s.status}</span></td>
                                <td><button class="btn btn-outline btn-sm" onclick="window.viewStudentReport('${s.user_id}')">Report</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderAdminTests(container) {
    const { data: students } = await supabase.from('profiles').select('*').eq('role', 'student').eq('status', 'active');
    const { data: results } = await supabase.from('test_results').select('*, profiles(full_name)').order('created_at', { ascending: false });

    container.innerHTML = `
        <div class="table-container" style="padding:1.25rem; margin-bottom:1.25rem;">
            <h3>Record Test Mark</h3>
            <form id="record-test-form" style="margin-top:1rem; display:flex; flex-direction:column; gap:0.75rem;">
                <input type="text" id="test-name" required placeholder="Test Name / Chapter">
                <select id="test-subject" required>
                    <option value="Applied Anatomy and Physiology">Applied Anatomy & Physiology</option>
                    <option value="Applied Psychology">Applied Psychology</option>
                    <option value="Nursing Foundation">Nursing Foundation</option>
                </select>
                <select id="test-student" required>
                    ${(students || []).map(s => `<option value="${s.user_id}">${s.full_name}</option>`).join('')}
                </select>
                <div style="display:flex; gap:0.5rem;">
                    <input type="number" id="test-obtained" required placeholder="Obtained" min="0" step="0.5">
                    <input type="number" id="test-max" required placeholder="Max Marks" value="20" step="0.5">
                </div>
                <input type="date" id="test-date" required>
                <button type="submit" class="btn btn-primary">Save Result</button>
            </form>
        </div>
        <div class="table-container">
            <div class="table-header-action"><h3>Recorded Marks</h3></div>
            <div class="table-responsive">
                <table>
                    <thead><tr><th>Date</th><th>Test</th><th>Student</th><th>Marks</th></tr></thead>
                    <tbody>
                        ${(results || []).map(r => `
                            <tr>
                                <td>${r.test_date}</td>
                                <td>${r.test_name}</td>
                                <td>${r.profiles?.full_name || 'N/A'}</td>
                                <td>${r.marks_obtained}/${r.maximum_marks}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('record-test-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const testName = document.getElementById('test-name').value;
        const subject = document.getElementById('test-subject').value;
        const studentId = document.getElementById('test-student').value;
        const obtained = parseFloat(document.getElementById('test-obtained').value);
        const max = parseFloat(document.getElementById('test-max').value);
        const testDate = document.getElementById('test-date').value;

        if (obtained > max) { showToast('Marks obtained cannot exceed maximum!', 'error'); return; }

        const { error } = await supabase.from('test_results').insert({
            student_id: studentId, test_name: testName, subject: subject,
            marks_obtained: obtained, maximum_marks: max, test_date: testDate
        });

        if (error) showToast(error.message, 'error');
        else { showToast('Test saved!', 'success'); renderAdminTests(container); }
    });
}

async function renderAdminAttendance(container) {
    const { data: students } = await supabase.from('profiles').select('*').eq('role', 'student').eq('status', 'active');
    container.innerHTML = `
        <div class="table-container" style="padding:1.25rem;">
            <h3>Record Attendance</h3>
            <form id="attendance-form" style="margin-top:1rem; display:flex; flex-direction:column; gap:0.75rem;">
                <input type="text" id="att-subject" required placeholder="Subject / Lecture Name">
                <input type="date" id="att-date" required>
                <select id="att-student" required>
                    ${(students || []).map(s => `<option value="${s.user_id}">${s.full_name}</option>`).join('')}
                </select>
                <select id="att-status" required>
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="leave">Leave</option>
                </select>
                <button type="submit" class="btn btn-primary">Save Attendance</button>
            </form>
        </div>
    `;

    document.getElementById('attendance-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = document.getElementById('att-subject').value;
        const sessionDate = document.getElementById('att-date').value;
        const studentId = document.getElementById('att-student').value;
        const status = document.getElementById('att-status').value;

        const { data: session, error: sErr } = await supabase.from('attendance_sessions').insert({
            subject, session_date: sessionDate, created_by: currentUser.id
        }).select().single();

        if (sErr) { showToast(sErr.message, 'error'); return; }

        const { error: rErr } = await supabase.from('attendance_records').insert({
            session_id: session.id, student_id: studentId, status
        });

        if (rErr) showToast(rErr.message, 'error');
        else showToast('Attendance recorded!', 'success');
    });
}

async function renderAdminApprovals(container) {
    const { data: pending } = await supabase.from('profiles').select('*').eq('role', 'student').eq('status', 'pending');
    container.innerHTML = `
        <div class="table-container">
            <div class="table-header-action"><h3>Pending Approvals (${pending?.length || 0})</h3></div>
            <div class="table-responsive">
                <table>
                    <thead><tr><th>Name</th><th>Email</th><th>Action</th></tr></thead>
                    <tbody>
                        ${(pending && pending.length > 0) ? pending.map(s => `
                            <tr>
                                <td>${s.full_name}</td>
                                <td>${s.email}</td>
                                <td>
                                    <button class="btn btn-primary btn-sm" onclick="window.updateStatus('${s.user_id}', 'active')">Approve</button>
                                </td>
                            </tr>
                        `).join('') : `<tr><td colspan="3" style="text-align:center;">No pending students.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ================= STUDENT VIEWS =================
async function renderStudentDashboard(container) {
    const { data: results } = await supabase.from('test_results').select('*').eq('student_id', currentUser.id);
    const { data: attendance } = await supabase.from('attendance_records').select('*').eq('student_id', currentUser.id);

    let totalObtained = 0, totalMax = 0;
    (results || []).forEach(r => { totalObtained += Number(r.marks_obtained); totalMax += Number(r.maximum_marks); });
    const overallPct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : 'N/A';

    const validAtt = (attendance || []).filter(a => a.status === 'present' || a.status === 'absent');
    const present = validAtt.filter(a => a.status === 'present').length;
    const attPct = validAtt.length > 0 ? ((present / validAtt.length) * 100).toFixed(2) : 'Not available';

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><h4>Overall %</h4><div class="stat-value">${overallPct === 'N/A' ? 'N/A' : overallPct + '%'}</div></div>
            <div class="stat-card"><h4>Attendance</h4><div class="stat-value">${attPct === 'Not available' ? 'N/A' : attPct + '%'}</div></div>
        </div>
        <div class="table-container">
            <div class="table-header-action"><h3>Recent Tests</h3></div>
            <div class="table-responsive">
                <table>
                    <thead><tr><th>Date</th><th>Test</th><th>Marks</th></tr></thead>
                    <tbody>
                        ${(results && results.length > 0) ? results.slice(0, 5).map(r => `
                            <tr>
                                <td>${r.test_date}</td>
                                <td>${r.test_name}</td>
                                <td>${r.marks_obtained}/${r.maximum_marks}</td>
                            </tr>
                        `).join('') : `<tr><td colspan="3" style="text-align:center;">No tests recorded.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderStudentTests(container) {
    const { data: results } = await supabase.from('test_results').select('*').eq('student_id', currentUser.id).order('test_date', { ascending: false });
    container.innerHTML = `
        <div class="table-container">
            <div class="table-header-action"><h3>My Test Results</h3></div>
            <div class="table-responsive">
                <table>
                    <thead><tr><th>Date</th><th>Test Name</th><th>Subject</th><th>Marks</th></tr></thead>
                    <tbody>
                        ${(results && results.length > 0) ? results.map(r => `
                            <tr>
                                <td>${r.test_date}</td>
                                <td>${r.test_name}</td>
                                <td>${r.subject}</td>
                                <td>${r.marks_obtained}/${r.maximum_marks}</td>
                            </tr>
                        `).join('') : `<tr><td colspan="4" style="text-align:center;">No results found.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderStudentAttendance(container) {
    const { data: attendance } = await supabase.from('attendance_records').select('*, attendance_sessions(subject, session_date)').eq('student_id', currentUser.id);
    container.innerHTML = `
        <div class="table-container">
            <div class="table-header-action"><h3>Attendance History</h3></div>
            <div class="table-responsive">
                <table>
                    <thead><tr><th>Date</th><th>Subject</th><th>Status</th></tr></thead>
                    <tbody>
                        ${(attendance && attendance.length > 0) ? attendance.map(a => `
                            <tr>
                                <td>${a.attendance_sessions?.session_date}</td>
                                <td>${a.attendance_sessions?.subject}</td>
                                <td><span class="badge ${a.status === 'present' ? 'badge-success' : 'badge-danger'}">${a.status}</span></td>
                            </tr>
                        `).join('') : `<tr><td colspan="3" style="text-align:center;">No attendance records.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderStudentProfile(container) {
    container.innerHTML = `
        <div class="table-container" style="padding:1.25rem;">
            <h3>Edit Profile</h3>
            <form id="profile-form" style="margin-top:1rem; display:flex; flex-direction:column; gap:0.75rem;">
                <input type="text" id="prof-name" value="${currentProfile.full_name || ''}" required placeholder="Full Name">
                <input type="date" id="prof-dob" value="${currentProfile.dob || ''}" required>
                <input type="file" id="prof-avatar" accept="image/*">
                <button type="submit" class="btn btn-primary">Update Profile</button>
            </form>
        </div>
    `;

    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('prof-name').value;
        const dob = document.getElementById('prof-dob').value;
        const fileInput = document.getElementById('prof-avatar');
        let avatarPath = currentProfile.avatar_path;

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            const fileName = `${currentUser.id}-${Math.random()}.${file.name.split('.').pop()}`;
            await supabase.storage.from('avatars').upload(fileName, file);
            avatarPath = fileName;
        }

        const { error } = await supabase.from('profiles').update({ full_name: fullName, dob, avatar_path: avatarPath }).eq('user_id', currentUser.id);
        if (error) showToast(error.message, 'error');
        else { showToast('Profile updated!', 'success'); currentProfile.full_name = fullName; currentProfile.dob = dob; currentProfile.avatar_path = avatarPath; renderNavigation(); }
    });
}

// Globals
window.updateStatus = async (userId, status) => {
    await supabase.from('profiles').update({ status }).eq('user_id', userId);
    showToast('Student approved!', 'success');
    loadDashboardView();
};

window.viewStudentReport = async (userId) => {
    const { data: s } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
    const { data: res } = await supabase.from('test_results').select('*').eq('student_id', userId);
    
    let obtained = 0, max = 0;
    (res || []).forEach(r => { obtained += Number(r.marks_obtained); max += Number(r.maximum_marks); });
    const pct = max > 0 ? ((obtained / max) * 100).toFixed(1) : 'N/A';

    const modal = document.getElementById('modal-container');
    document.getElementById('modal-title').textContent = s.full_name;
    document.getElementById('modal-body').innerHTML = `
        <p><strong>Email:</strong> ${s.email}</p>
        <p><strong>Overall %:</strong> ${pct}%</p>
        <p><strong>Tests Taken:</strong> ${res?.length || 0}</p>
    `;
    modal.classList.remove('hidden');
    document.getElementById('modal-close-btn').onclick = () => modal.classList.add('hidden');
};

function showAuthAlert(msg, type) {
    const err = document.getElementById('auth-error');
    const succ = document.getElementById('auth-success');
    if (type === 'error') { err.textContent = msg; err.classList.remove('hidden'); succ.classList.add('hidden'); }
    else { succ.textContent = msg; succ.classList.remove('hidden'); err.classList.add('hidden'); }
}

function clearAlerts() {
    document.getElementById('auth-error').classList.add('hidden');
    document.getElementById('auth-success').classList.add('hidden');
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showAuthView() {
    document.getElementById('app-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
}
