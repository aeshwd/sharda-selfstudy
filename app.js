import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ==========================================
// CONFIGURATION (Replace with your Supabase credentials)
// ==========================================
const SUPABASE_URL = 'https://vmnjmdxxhvzwqselmune.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtbmptZHh4aHZ6d3FzZWxtdW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE2Njk1NTYsImV4cCI6MjEwNzI0NTU1Nn0.FRnVf28yulp8mCl7UoQdNRfqYdR6jWMvshMENlydlWA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State Management
let currentUser = null;
let currentProfile = null;

// DOMContentLoaded Initialization
document.addEventListener('DOMContentLoaded', async () => {
    initSplash();
    initAuthTabs();
    initAuthForms();
    
    // Check active session
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        await handleAuthSession(session.user);
    } else {
        showAuthView();
    }
});

// Splash Screen Logic
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
        setTimeout(() => splash.remove(), 500);
    });
}

// Auth Tabs
function initAuthTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.tab;
            if (target === 'login') {
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

// Auth Form Submissions
function initAuthForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        showAuthAlert('Signing in...', 'success');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            showAuthAlert(error.message, 'error');
        } else {
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
            email,
            password,
            options: {
                data: { full_name: fullName, dob: dob }
            }
        });

        if (error) {
            showAuthAlert(error.message, 'error');
        } else {
            showAuthAlert('Registration successful! Your account is pending administrator approval.', 'success');
            registerForm.reset();
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        currentUser = null;
        currentProfile = null;
        showAuthView();
        showToast('Logged out successfully', 'success');
    });

    document.getElementById('forgot-password-link').addEventListener('click', async (e) => {
        e.preventDefault();
        const email = prompt('Enter your registered email address for password reset:');
        if (!email) return;
        
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });
        if (error) showToast(error.message, 'error');
        else showToast('Password reset email sent. Check your inbox.', 'success');
    });
}

async function handleAuthSession(user) {
    currentUser = user;
    // Fetch profile
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error || !profile) {
        showAuthAlert('Profile not found or database error. Contact admin.', 'error');
        await supabase.auth.signOut();
        return;
    }

    currentProfile = profile;

    // Check approval status for students
    if (profile.role === 'student' && profile.status !== 'active') {
        await supabase.auth.signOut();
        showAuthAlert(`Your account is currently ${profile.status}. Please wait for admin approval.`, 'error');
        showAuthView();
        return;
    }

    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');

    updateSidebarUserInfo();
    renderNavigation();
    loadDashboardView();
}

function updateSidebarUserInfo() {
    document.getElementById('sidebar-name').textContent = currentProfile.full_name || 'User';
    document.getElementById('sidebar-email').textContent = currentProfile.email || currentUser.email;
    document.getElementById('user-role-badge').textContent = currentProfile.role;

    const avatarEl = document.getElementById('sidebar-avatar');
    if (currentProfile.avatar_path) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(currentProfile.avatar_path);
        avatarEl.innerHTML = `<img src="${data.publicUrl}" alt="Avatar">`;
    } else {
        const initials = currentProfile.full_name ? currentProfile.full_name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase() : 'SS';
        avatarEl.textContent = initials;
    }
}

// Navigation & View Rendering
function renderNavigation() {
    const navContainer = document.getElementById('sidebar-nav-links');
    navContainer.innerHTML = '';

    const role = currentProfile.role;
    let links = [];

    if (role === 'admin') {
        links = [
            { id: 'admin-dash', label: 'Dashboard', icon: '📊' },
            { id: 'admin-students', label: 'Student Directory', icon: '🎓' },
            { id: 'admin-tests', label: 'Test Management', icon: '📝' },
            { id: 'admin-attendance', label: 'Attendance', icon: '📅' },
            { id: 'admin-approvals', label: 'Pending Approvals', icon: '⏳' }
        ];
    } else {
        links = [
            { id: 'student-dash', label: 'My Dashboard', icon: '📊' },
            { id: 'student-tests', label: 'My Test Results', icon: '📝' },
            { id: 'student-attendance', label: 'My Attendance', icon: '📅' },
            { id: 'student-profile', label: 'Edit Profile', icon: '⚙️' }
        ];
    }

    links.forEach((link, idx) => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = `nav-item ${idx === 0 ? 'active' : ''}`;
        a.innerHTML = `<span>${link.icon}</span> <span>${link.label}</span>`;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
            a.classList.add('active');
            switchView(link.id);
        });
        navContainer.appendChild(a);
    });
}

function switchView(viewId) {
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    const contentEl = document.getElementById('dashboard-content');
    contentEl.innerHTML = '<div class="text-muted" style="text-align:center; padding:3rem;">Loading...</div>';

    if (currentProfile.role === 'admin') {
        if (viewId === 'admin-dash') {
            titleEl.textContent = 'Admin Dashboard';
            subtitleEl.textContent = 'Overview of student performance and attendance';
            renderAdminDashboard(contentEl);
        } else if (viewId === 'admin-students') {
            titleEl.textContent = 'Student Directory';
            subtitleEl.textContent = 'Manage registered students and view individual reports';
            renderAdminStudents(contentEl);
        } else if (viewId === 'admin-tests') {
            titleEl.textContent = 'Test Management';
            subtitleEl.textContent = 'Create and record student examination marks';
            renderAdminTests(contentEl);
        } else if (viewId === 'admin-attendance') {
            titleEl.textContent = 'Attendance Management';
            subtitleEl.textContent = 'Record and monitor class sessions';
            renderAdminAttendance(contentEl);
        } else if (viewId === 'admin-approvals') {
            titleEl.textContent = 'Student Approvals';
            subtitleEl.textContent = 'Approve or block student registrations';
            renderAdminApprovals(contentEl);
        }
    } else {
        if (viewId === 'student-dash') {
            titleEl.textContent = `Welcome, ${currentProfile.full_name}`;
            subtitleEl.textContent = 'Your personal academic performance summary';
            renderStudentDashboard(contentEl);
        } else if (viewId === 'student-tests') {
            titleEl.textContent = 'My Test History';
            subtitleEl.textContent = 'Detailed breakdown of all your test scores';
            renderStudentTests(contentEl);
        } else if (viewId === 'student-attendance') {
            titleEl.textContent = 'My Attendance Records';
            subtitleEl.textContent = 'Session-wise attendance history';
            renderStudentAttendance(contentEl);
        } else if (viewId === 'student-profile') {
            titleEl.textContent = 'Profile Settings';
            subtitleEl.textContent = 'Update your personal details and avatar';
            renderStudentProfile(contentEl);
        }
    }
}

function loadDashboardView() {
    const defaultView = currentProfile.role === 'admin' ? 'admin-dash' : 'student-dash';
    switchView(defaultView);
}

// ==========================================
// ADMIN VIEWS & LOGIC
// ==========================================
async function renderAdminDashboard(container) {
    // Fetch stats
    const [{ count: totalStudents }, { count: pendingStudents }, { count: totalTests }, { data: testResults }, { data: attendance }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student').eq('status', 'pending'),
        supabase.from('tests').select('*', { count: 'exact', head: true }),
        supabase.from('test_results').select('marks_obtained, maximum_marks'),
        supabase.from('attendance_records').select('status')
    ]);

    // Calculate overall academic percentage (weighted)
    let totalObtained = 0, totalMax = 0;
    (testResults || []).forEach(r => {
        totalObtained += Number(r.marks_obtained);
        totalMax += Number(r.maximum_marks);
    });
    const overallPct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : 'N/A';

    // Calculate overall attendance percentage
    const validAttendance = (attendance || []).filter(a => a.status === 'present' || a.status === 'absent');
    const presentCount = validAttendance.filter(a => a.status === 'present').length;
    const attendancePct = validAttendance.length > 0 ? ((presentCount / validAttendance.length) * 100).toFixed(2) : 'Not available';

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h4>Total Students</h4>
                <div class="stat-value">${totalStudents || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Pending Approvals</h4>
                <div class="stat-value" style="color: var(--warning);">${pendingStudents || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Total Tests Recorded</h4>
                <div class="stat-value">${totalTests || 0}</div>
            </div>
            <div class="stat-card">
                <h4>Overall Performance</h4>
                <div class="stat-value">${overallPct === 'N/A' ? 'N/A' : overallPct + '%'}</div>
            </div>
            <div class="stat-card">
                <h4>Overall Attendance</h4>
                <div class="stat-value">${attendancePct === 'Not available' ? 'N/A' : attendancePct + '%'}</div>
            </div>
        </div>
        <div class="table-container">
            <div class="table-header-action">
                <h3>Quick System Overview</h3>
            </div>
            <div style="padding: 1.5rem;">
                <p>Use the sidebar navigation to manage students, record test marks, update attendance records, and review student progress reports securely.</p>
            </div>
        </div>
    `;
}

async function renderAdminStudents(container) {
    const { data: students, error } = await supabase.from('profiles').select('*').eq('role', 'student');
    if (error) { container.innerHTML = `<div class="alert alert-error">${error.message}</div>`; return; }

    container.innerHTML = `
        <div class="table-container">
            <div class="table-header-action">
                <h3>Registered Students (${students.length})</h3>
                <input type="text" id="student-search" class="table-search" placeholder="Search by name or email...">
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Student</th>
                        <th>Email</th>
                        <th>DOB</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="students-tbody">
                    ${students.map(s => `
                        <tr>
                            <td>
                                <div class="flex items-center gap-2">
                                    <div class="avatar-placeholder" style="width:30px; height:30px; font-size:0.75rem;">${s.full_name.substring(0,2).toUpperCase()}</div>
                                    <span>${s.full_name}</span>
                                </div>
                            </td>
                            <td>${s.email}</td>
                            <td>${s.dob || 'N/A'}</td>
                            <td><span class="badge ${s.status === 'active' ? 'badge-success' : s.status === 'pending' ? 'badge-warning' : 'badge-danger'}">${s.status}</span></td>
                            <td>
                                <button class="btn btn-outline btn-sm" onclick="window.viewStudentReport('${s.user_id}')">View Report</button>
                                ${s.status === 'pending' ? `<button class="btn btn-primary btn-sm" onclick="window.updateStudentStatus('${s.user_id}', 'active')">Approve</button>` : ''}
                                ${s.status === 'active' ? `<button class="btn btn-danger btn-sm" onclick="window.updateStudentStatus('${s.user_id}', 'blocked')">Block</button>` : ''}
                                ${s.status === 'blocked' ? `<button class="btn btn-primary btn-sm" onclick="window.updateStudentStatus('${s.user_id}', 'active')">Unblock</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Search functionality
    document.getElementById('student-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#students-tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(query) ? '' : 'none';
        });
    });
}

async function renderAdminTests(container) {
    const { data: tests } = await supabase.from('tests').select('*').order('test_date', { ascending: false });
    const { data: students } = await supabase.from('profiles').select('*').eq('role', 'student').eq('status', 'active');

    container.innerHTML = `
        <div class="table-container" style="margin-bottom: 2rem; padding: 1.5rem;">
            <h3>Record New Test Result</h3>
            <form id="record-test-form" style="margin-top: 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div class="form-group">
                    <label>Test Name / Chapter</label>
                    <input type="text" id="test-name" required placeholder="Digestive System Test">
                </div>
                <div class="form-group">
                    <label>Subject</label>
                    <select id="test-subject" required>
                        <option value="Applied Anatomy and Physiology">Applied Anatomy and Physiology</option>
                        <option value="Applied Psychology">Applied Psychology</option>
                        <option value="Applied Sociology">Applied Sociology</option>
                        <option value="English">English</option>
                        <option value="Nursing Foundation">Nursing Foundation</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Student</label>
                    <select id="test-student" required>
                        ${(students || []).map(s => `<option value="${s.user_id}">${s.full_name} (${s.email})</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Marks Obtained</label>
                    <input type="number" id="test-obtained" required min="0" step="0.5">
                </div>
                <div class="form-group">
                    <label>Maximum Marks</label>
                    <input type="number" id="test-max" required min="1" value="20" step="0.5">
                </div>
                <div class="form-group">
                    <label>Test Date</label>
                    <input type="date" id="test-date" required>
                </div>
                <div style="grid-column: 1 / -1;">
                    <button type="submit" class="btn btn-primary">Save Test Result</button>
                </div>
            </form>
        </div>

        <div class="table-container">
            <div class="table-header-action">
                <h3>Recorded Tests History</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Test Name</th>
                        <th>Subject</th>
                        <th>Student</th>
                        <th>Marks</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody id="tests-history-tbody">
                    <!-- Loaded dynamically -->
                </tbody>
            </table>
        </div>
    `;

    // Load test results with student names
    const { data: results } = await supabase.from('test_results').select('*, profiles(full_name)').order('created_at', { ascending: false });
    const tbody = document.getElementById('tests-history-tbody');
    if (results && results.length > 0) {
        tbody.innerHTML = results.map(r => {
            const pct = ((r.marks_obtained / r.maximum_marks) * 100).toFixed(1);
            return `
                <tr>
                    <td>${r.test_date || 'N/A'}</td>
                    <td>${r.test_name}</td>
                    <td>${r.subject}</td>
                    <td>${r.profiles?.full_name || 'Unknown'}</td>
                    <td>${r.marks_obtained} / ${r.maximum_marks}</td>
                    <td><span class="badge badge-primary">${pct}%</span></td>
                </tr>
            `;
        }).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No test results recorded yet.</td></tr>`;
    }

    document.getElementById('record-test-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const testName = document.getElementById('test-name').value;
        const subject = document.getElementById('test-subject').value;
        const studentId = document.getElementById('test-student').value;
        const obtained = parseFloat(document.getElementById('test-obtained').value);
        const max = parseFloat(document.getElementById('test-max').value);
        const testDate = document.getElementById('test-date').value;

        if (obtained > max) {
            showToast('Marks obtained cannot be greater than maximum marks!', 'error');
            return;
        }

        const { error } = await supabase.from('test_results').insert({
            student_id: studentId,
            test_name: testName,
            subject: subject,
            marks_obtained: obtained,
            maximum_marks: max,
            test_date: testDate
        });

        if (error) showToast(error.message, 'error');
        else {
            showToast('Test result recorded successfully!', 'success');
            renderAdminTests(container);
        }
    });
}

async function renderAdminAttendance(container) {
    const { data: students } = await supabase.from('profiles').select('*').eq('role', 'student').eq('status', 'active');

    container.innerHTML = `
        <div class="table-container" style="padding: 1.5rem; margin-bottom: 2rem;">
            <h3>Record Attendance Session</h3>
            <form id="attendance-form" style="margin-top: 1rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                <div class="form-group">
                    <label>Subject / Session Name</label>
                    <input type="text" id="att-subject" required placeholder="Applied Anatomy Lecture">
                </div>
                <div class="form-group">
                    <label>Session Date</label>
                    <input type="date" id="att-date" required>
                </div>
                <div class="form-group">
                    <label>Student</label>
                    <select id="att-student" required>
                        ${(students || []).map(s => `<option value="${s.user_id}">${s.full_name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="att-status" required>
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="leave">Leave</option>
                    </select>
                </div>
                <div style="grid-column: 1 / -1;">
                    <button type="submit" class="btn btn-primary">Save Attendance Record</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('attendance-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const subject = document.getElementById('att-subject').value;
        const sessionDate = document.getElementById('att-date').value;
        const studentId = document.getElementById('att-student').value;
        const status = document.getElementById('att-status').value;

        // Create session first or get existing
        const { data: session, error: sError } = await supabase.from('attendance_sessions').insert({
            subject: subject,
            session_date: sessionDate,
            created_by: currentUser.id
        }).select().single();

        if (sError) {
            showToast(sError.message, 'error');
            return;
        }

        const { error: rError } = await supabase.from('attendance_records').insert({
            session_id: session.id,
            student_id: studentId,
            status: status
        });

        if (rError) showToast(rError.message, 'error');
        else showToast('Attendance recorded successfully!', 'success');
    });
}

async function renderAdminApprovals(container) {
    const { data: pending } = await supabase.from('profiles').select('*').eq('role', 'student').eq('status', 'pending');

    container.innerHTML = `
        <div class="table-container">
            <div class="table-header-action">
                <h3>Pending Student Approvals (${pending?.length || 0})</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Date of Birth</th>
                        <th>Registered Date</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${(pending && pending.length > 0) ? pending.map(s => `
                        <tr>
                            <td>${s.full_name}</td>
                            <td>${s.email}</td>
                            <td>${s.dob || 'N/A'}</td>
                            <td>${new Date(s.created_at).toLocaleDateString()}</td>
                            <td>
                                <button class="btn btn-primary btn-sm" onclick="window.updateStudentStatus('${s.user_id}', 'active')">Approve</button>
                                <button class="btn btn-danger btn-sm" onclick="window.updateStudentStatus('${s.user_id}', 'blocked')">Reject</button>
                            </td>
                        </tr>
                    `).join('') : `<tr><td colspan="5" style="text-align:center;">No pending student approvals.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

// Global helper attached to window for inline onclick handlers
window.updateStudentStatus = async (userId, newStatus) => {
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('user_id', userId);
    if (error) showToast(error.message, 'error');
    else {
        showToast(`Student status updated to ${newStatus}`, 'success');
        location.reload();
    }
};

window.viewStudentReport = async (userId) => {
    const { data: student } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
    const { data: results } = await supabase.from('test_results').select('*').eq('student_id', userId);
    const { data: attendance } = await supabase.from('attendance_records').select('*').eq('student_id', userId);

    let totalObtained = 0, totalMax = 0;
    (results || []).forEach(r => {
        totalObtained += Number(r.marks_obtained);
        totalMax += Number(r.maximum_marks);
    });
    const overallPct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : 'N/A';

    const validAtt = (attendance || []).filter(a => a.status === 'present' || a.status === 'absent');
    const present = validAtt.filter(a => a.status === 'present').length;
    const attPct = validAtt.length > 0 ? ((present / validAtt.length) * 100).toFixed(2) : 'Not available';

    const modalContainer = document.getElementById('modal-container');
    document.getElementById('modal-title').textContent = `Academic Report: ${student.full_name}`;
    document.getElementById('modal-body').innerHTML = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
            <p><strong>Email:</strong> ${student.email}</p>
            <p><strong>Date of Birth:</strong> ${student.dob || 'N/A'}</p>
            <p><strong>Overall Percentage:</strong> ${overallPct === 'N/A' ? 'N/A' : overallPct + '%'}</p>
            <p><strong>Attendance Percentage:</strong> ${attPct === 'Not available' ? 'Not available' : attPct + '%'}</p>
            <p><strong>Total Tests Taken:</strong> ${results?.length || 0}</p>
            <hr>
            <h4>Test History</h4>
            <ul>
                ${(results && results.length > 0) ? results.map(r => `<li>${r.test_name} (${r.subject}): ${r.marks_obtained}/${r.maximum_marks}</li>`).join('') : '<li>No tests recorded.</li>'}
            </ul>
        </div>
    `;
    modalContainer.classList.remove('hidden');
    document.getElementById('modal-close-btn').onclick = () => modalContainer.classList.add('hidden');
};


// ==========================================
// STUDENT VIEWS & LOGIC
// ==========================================
async function renderStudentDashboard(container) {
    const { data: results } = await supabase.from('test_results').select('*').eq('student_id', currentUser.id);
    const { data: attendance } = await supabase.from('attendance_records').select('*').eq('student_id', currentUser.id);

    let totalObtained = 0, totalMax = 0;
    (results || []).forEach(r => {
        totalObtained += Number(r.marks_obtained);
        totalMax += Number(r.maximum_marks);
    });
    const overallPct = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) : 'N/A';

    const validAtt = (attendance || []).filter(a => a.status === 'present' || a.status === 'absent');
    const present = validAtt.filter(a => a.status === 'present').length;
    const attPct = validAtt.length > 0 ? ((present / validAtt.length) * 100).toFixed(2) : 'Not available';

    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h4>Overall Percentage</h4>
                <div class="stat-value">${overallPct === 'N/A' ? 'N/A' : overallPct + '%'}</div>
            </div>
            <div class="stat-card">
                <h4>Attendance Percentage</h4>
                <div class="stat-value">${attPct === 'Not available' ? 'Not available' : attPct + '%'}</div>
            </div>
            <div class="stat-card">
                <h4>Tests Completed</h4>
                <div class="stat-value">${results?.length || 0}</div>
            </div>
        </div>
        <div class="table-container">
            <div class="table-header-action">
                <h3>Recent Test Results</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Test Name</th>
                        <th>Subject</th>
                        <th>Marks</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${(results && results.length > 0) ? results.slice(0, 5).map(r => {
                        const pct = ((r.marks_obtained / r.maximum_marks) * 100).toFixed(1);
                        return `
                            <tr>
                                <td>${r.test_date || 'N/A'}</td>
                                <td>${r.test_name}</td>
                                <td>${r.subject}</td>
                                <td>${r.marks_obtained} /${r.maximum_marks}</td>
                                <td><span class="badge badge-primary">${pct}%</span></td>
                            </tr>
                        `;
                    }).join('') : `<tr><td colspan="5" style="text-align:center;">No tests recorded.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

async function renderStudentTests(container) {
    const { data: results } = await supabase.from('test_results').select('*').eq('student_id', currentUser.id).order('test_date', { ascending: false });

    container.innerHTML = `
        <div class="table-container">
            <div class="table-header-action">
                <h3>All Test Results</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Test Name</th>
                        <th>Subject</th>
                        <th>Marks Obtained</th>
                        <th>Maximum Marks</th>
                        <th>Percentage</th>
                    </tr>
                </thead>
                <tbody>
                    ${(results && results.length > 0) ? results.map(r => {
                        const pct = ((r.marks_obtained / r.maximum_marks) * 100).toFixed(1);
                        return `
                            <tr>
                                <td>${r.test_date || 'N/A'}</td>
                                <td>${r.test_name}</td>
                                <td>${r.subject}</td>
                                <td>${r.marks_obtained}</td>
                                <td>${r.maximum_marks}</td>
                                <td><span class="badge badge-primary">${pct}%</span></td>
                            </tr>
                        `;
                    }).join('') : `<tr><td colspan="6" style="text-align:center;">No test results recorded.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

async function renderStudentAttendance(container) {
    const { data: attendance } = await supabase.from('attendance_records').select('*, attendance_sessions(subject, session_date)').eq('student_id', currentUser.id);

    container.innerHTML = `
        <div class="table-container">
            <div class="table-header-action">
                <h3>Attendance History</h3>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Subject / Session</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${(attendance && attendance.length > 0) ? attendance.map(a => `
                        <tr>
                            <td>${a.attendance_sessions?.session_date || 'N/A'}</td>
                            <td>${a.attendance_sessions?.subject || 'Class Session'}</td>
                            <td><span class="badge ${a.status === 'present' ? 'badge-success' : 'badge-danger'}">${a.status}</span></td>
                        </tr>
                    `).join('') : `<tr><td colspan="3" style="text-align:center;">No attendance records available.</td></tr>`}
                </tbody>
            </table>
        </div>
    `;
}

async function renderStudentProfile(container) {
    container.innerHTML = `
        <div class="table-container" style="padding: 2rem; max-width: 600px;">
            <h3>Edit Personal Profile</h3>
            <form id="profile-form" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="prof-name" value="${currentProfile.full_name || ''}" required>
                </div>
                <div class="form-group">
                    <label>Date of Birth</label>
                    <input type="date" id="prof-dob" value="${currentProfile.dob || ''}" required>
                </div>
                <div class="form-group">
                    <label>Profile Picture (JPG, PNG, WebP, max 2MB)</label>
                    <input type="file" id="prof-avatar" accept="image/png, image/jpeg, image/webp">
                </div>
                <button type="submit" class="btn btn-primary">Save Changes</button>
            </form>
            <hr style="margin: 2rem 0; border:0; border-top: 1px solid var(--gray-200);">
            <h3>Change Password</h3>
            <form id="password-form" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
                <div class="form-group">
                    <label>New Password</label>
                    <input type="password" id="new-password" required placeholder="••••••••">
                </div>
                <button type="submit" class="btn btn-outline">Update Password</button>
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
            if (file.size > 2 * 1024 * 1024) {
                showToast('File size must be less than 2MB', 'error');
                return;
            }
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if (uploadError) {
                showToast(uploadError.message, 'error');
                return;
            }
            avatarPath = fileName;
        }

        const { error } = await supabase.from('profiles').update({
            full_name: fullName,
            dob: dob,
            avatar_path: avatarPath
        }).eq('user_id', currentUser.id);

        if (error) showToast(error.message, 'error');
        else {
            showToast('Profile updated successfully!', 'success');
            currentProfile.full_name = fullName;
            currentProfile.dob = dob;
            currentProfile.avatar_path = avatarPath;
            updateSidebarUserInfo();
        }
    });

    document.getElementById('password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) showToast(error.message, 'error');
        else {
            showToast('Password updated successfully!', 'success');
            e.target.reset();
        }
    });
}

// Helper Notifications
function showAuthAlert(message, type) {
    const errEl = document.getElementById('auth-error');
    const succEl = document.getElementById('auth-success');
    if (type === 'error') {
        errEl.textContent = message;
        errEl.classList.remove('hidden');
        succEl.classList.add('hidden');
    } else {
        succEl.textContent = message;
        succEl.classList.remove('hidden');
        errEl.classList.add('hidden');
    }
}

function clearAlerts() {
    document.getElementById('auth-error').classList.add('hidden');
    document.getElementById('auth-success').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function showAuthView() {
    document.getElementById('app-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
}