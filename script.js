// Константы
const HOURLY_RATE = 125; // руб/час
const SHIFT_START_LIMIT = '09:00';
const SHIFT_END_LIMIT = '21:00';
const ADMIN_PASSWORD = 'asdzxc2547'; // Пароль администратора по умолчанию

// Данные
let employees = [];
let shifts = [];

// Текущий пользователь
let currentUser = null;

// Функции синхронизации с Firebase
function showSyncIndicator() {
    const indicator = document.getElementById('syncIndicator');
    if (indicator) {
        indicator.style.display = 'block';
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 2000);
    }
}

// Загрузка данных из Firebase
async function loadDataFromFirebase() {
    if (!useFirebase || !db) {
        // Используем localStorage если Firebase не настроен
        employees = JSON.parse(localStorage.getItem('employees')) || [];
        shifts = JSON.parse(localStorage.getItem('shifts')) || [];
        return;
    }

    try {
        showSyncIndicator();
        
        // Загрузка сотрудников
        const employeesSnapshot = await db.collection('employees').get();
        employees = employeesSnapshot.docs.map(doc => {
            const data = doc.data();
            // Используем ID из данных документа, если есть, иначе используем ID документа
            const empId = data.originalId || (typeof doc.id === 'string' && !isNaN(doc.id) ? parseInt(doc.id) : doc.id);
            return {
                id: empId,
                name: data.name,
                password: data.password
            };
        });
        
        // Загрузка смен
        const shiftsSnapshot = await db.collection('shifts').get();
        shifts = shiftsSnapshot.docs.map(doc => {
            const data = doc.data();
            // Используем originalId если есть, иначе ID документа
            const shiftId = data.originalId || (typeof doc.id === 'string' && !isNaN(doc.id) ? parseInt(doc.id) : doc.id);
            return {
                id: shiftId,
                employeeId: typeof data.employeeId === 'string' ? parseInt(data.employeeId) : data.employeeId,
                date: data.date,
                start: data.start,
                end: data.end
            };
        });

        // Сохраняем в localStorage для оффлайн доступа
        localStorage.setItem('employees', JSON.stringify(employees));
        localStorage.setItem('shifts', JSON.stringify(shifts));
        
        console.log('✅ Данные загружены из Firebase');
    } catch (error) {
        console.error('❌ Ошибка загрузки данных из Firebase:', error);
        // Fallback на localStorage
        employees = JSON.parse(localStorage.getItem('employees')) || [];
        shifts = JSON.parse(localStorage.getItem('shifts')) || [];
    }
}

// Сохранение сотрудников
async function saveEmployees() {
    // Сохраняем в localStorage для оффлайн доступа
    localStorage.setItem('employees', JSON.stringify(employees));
    
    if (!useFirebase || !db) return;

    try {
        showSyncIndicator();
        
        // Синхронизация с Firebase
        const batch = db.batch();
        
        // Получаем текущие документы
        const snapshot = await db.collection('employees').get();
        const existingDocs = {};
        snapshot.docs.forEach(doc => {
            existingDocs[doc.id] = doc;
        });

        // Обновляем или создаем документы
        for (const emp of employees) {
            const empId = String(emp.id);
            const empRef = db.collection('employees').doc(empId);
            
            const empData = {
                originalId: emp.id, // Сохраняем исходный числовой ID
                name: emp.name,
                password: emp.password
            };
            
            if (existingDocs[empId]) {
                batch.update(empRef, empData);
            } else {
                batch.set(empRef, empData);
            }
        }

        // Удаляем документы, которых нет в текущем списке
        const currentIds = employees.map(emp => String(emp.id));
        snapshot.docs.forEach(doc => {
            if (!currentIds.includes(doc.id)) {
                batch.delete(doc.ref);
            }
        });

        await batch.commit();
        console.log('✅ Сотрудники сохранены в Firebase');
    } catch (error) {
        console.error('❌ Ошибка сохранения сотрудников в Firebase:', error);
    }
}

// Сохранение смен
async function saveShifts() {
    // Сохраняем в localStorage для оффлайн доступа
    localStorage.setItem('shifts', JSON.stringify(shifts));
    
    if (!useFirebase || !db) return;

    try {
        showSyncIndicator();
        
        // Синхронизация с Firebase
        const batch = db.batch();
        
        // Получаем текущие документы
        const snapshot = await db.collection('shifts').get();
        const existingDocs = {};
        snapshot.docs.forEach(doc => {
            existingDocs[doc.id] = doc;
        });

        // Обновляем или создаем документы
        for (const shift of shifts) {
            const shiftId = String(shift.id);
            const shiftRef = db.collection('shifts').doc(shiftId);
            
            const shiftData = {
                originalId: shift.id, // Сохраняем исходный ID
                employeeId: shift.employeeId,
                date: shift.date,
                start: shift.start,
                end: shift.end
            };
            
            if (existingDocs[shiftId]) {
                batch.update(shiftRef, shiftData);
            } else {
                batch.set(shiftRef, shiftData);
            }
        }

        // Удаляем документы, которых нет в текущем списке
        const currentIds = shifts.map(shift => String(shift.id));
        snapshot.docs.forEach(doc => {
            if (!currentIds.includes(doc.id)) {
                batch.delete(doc.ref);
            }
        });

        await batch.commit();
        console.log('✅ Смены сохранены в Firebase');
    } catch (error) {
        console.error('❌ Ошибка сохранения смен в Firebase:', error);
    }
}

// Настройка real-time синхронизации
function setupRealtimeSync() {
    if (!useFirebase || !db) return;

    // Слушаем изменения в сотрудниках
    db.collection('employees').onSnapshot((snapshot) => {
        const hasChanges = snapshot.docChanges().length > 0;
        if (hasChanges) {
            employees = snapshot.docs.map(doc => {
                const data = doc.data();
                const empId = data.originalId || (typeof doc.id === 'string' && !isNaN(doc.id) ? parseInt(doc.id) : doc.id);
                return {
                    id: empId,
                    name: data.name,
                    password: data.password
                };
            });
            localStorage.setItem('employees', JSON.stringify(employees));
            renderEmployees();
            renderPasswordManagement();
            updateEmployeeSelects();
            updateEmployeeSelectForLogin();
            console.log('🔄 Сотрудники обновлены в реальном времени');
        }
    }, (error) => {
        console.error('❌ Ошибка real-time синхронизации сотрудников:', error);
    });

    // Слушаем изменения в сменах
    db.collection('shifts').onSnapshot((snapshot) => {
        const hasChanges = snapshot.docChanges().length > 0;
        if (hasChanges) {
            shifts = snapshot.docs.map(doc => {
                const data = doc.data();
                const shiftId = data.originalId || (typeof doc.id === 'string' && !isNaN(doc.id) ? parseInt(doc.id) : doc.id);
                return {
                    id: shiftId,
                    employeeId: typeof data.employeeId === 'string' ? parseInt(data.employeeId) : data.employeeId,
                    date: data.date,
                    start: data.start,
                    end: data.end
                };
            });
            localStorage.setItem('shifts', JSON.stringify(shifts));
            renderShifts();
            updateCalendar();
            console.log('🔄 Смены обновлены в реальном времени');
        }
    }, (error) => {
        console.error('❌ Ошибка real-time синхронизации смен:', error);
    });
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    // Загружаем данные (из Firebase или localStorage)
    await loadDataFromFirebase();
    
    // Настраиваем real-time синхронизацию
    setupRealtimeSync();
    
    // Проверить, авторизован ли пользователь
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showApp();
    } else {
        showLogin();
    }
    
    setupLoginEventListeners();
    setupEmployeeSelectForLogin();
});

// Показать страницу входа
function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appContainer').style.display = 'none';
}

// Показать приложение
function showApp() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    
    // Обновить интерфейс в зависимости от роли
    updateUIForRole();
    
    // Инициализировать приложение
    initializeApp();
    setupEventListeners();
    
    // ВАЖНО: Убрать ограничение минимальной даты ПЕРЕД рендерингом
    removeDateMinRestriction();
    
    renderEmployees();
    renderPasswordManagement();
    renderShifts();
    updateCalendar();
    setupReportFilters();
    
    // Установить текущую дату по умолчанию (только если не редактируем)
    const shiftIdField = document.getElementById('shiftId');
    if (!shiftIdField || !shiftIdField.value) {
        if (document.getElementById('shiftDate')) {
            document.getElementById('shiftDate').valueAsDate = new Date();
            // Еще раз убрать min после установки даты
            removeDateMinRestriction();
        }
    }
    if (document.getElementById('reportStartDate')) {
        document.getElementById('reportStartDate').valueAsDate = new Date(new Date().setDate(1));
    }
    if (document.getElementById('reportEndDate')) {
        document.getElementById('reportEndDate').valueAsDate = new Date();
    }
    
    // Показать информацию о пользователе
    const roleText = currentUser.role === 'admin' ? 'Администратор' : currentUser.employeeName;
    document.getElementById('currentUserInfo').textContent = `👤 ${roleText}`;
}

// Функция для удаления ограничения минимальной даты
function removeDateMinRestriction() {
    const shiftDateInput = document.getElementById('shiftDate');
    if (shiftDateInput) {
        shiftDateInput.removeAttribute('min');
        // Устанавливаем минимальную дату в далеком прошлом, если браузер все равно требует min
        shiftDateInput.setAttribute('min', '2000-01-01');
        // И сразу убираем снова, чтобы разрешить любые даты
        setTimeout(() => {
            shiftDateInput.removeAttribute('min');
            shiftDateInput.setAttribute('max', '2099-12-31');
        }, 10);
    }
}

// Обновить интерфейс в зависимости от роли
function updateUIForRole() {
    if (currentUser.role === 'employee') {
        // Скрыть вкладки для сотрудников
        document.querySelectorAll('.tab-btn').forEach(btn => {
            const tab = btn.dataset.tab;
            if (tab === 'employees' || tab === 'shifts' || tab === 'calendar') {
                btn.style.display = 'none';
            }
        });
        
        // Показать только отчеты
        switchTab('reports');
        
        // Ограничить отчеты только своими данными
        const reportEmployeeGroup = document.getElementById('reportEmployeeGroup');
        if (reportEmployeeGroup) {
            reportEmployeeGroup.style.display = 'none';
        }
    } else {
        // Администратор видит все
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.style.display = 'block';
        });
    }
}

// Инициализация приложения
function initializeApp() {
    // Вызываем функцию удаления ограничения даты
    removeDateMinRestriction();
}

// Настройка обработчиков для страницы входа
function setupLoginEventListeners() {
    // Форма входа
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin();
        });
    }
    
    // Изменение роли в форме входа
    const loginRole = document.getElementById('loginRole');
    if (loginRole) {
        loginRole.addEventListener('change', (e) => {
            const role = e.target.value;
            const employeeSelectGroup = document.getElementById('employeeSelectGroup');
            if (role === 'employee') {
                employeeSelectGroup.style.display = 'block';
                updateEmployeeSelectForLogin();
            } else {
                employeeSelectGroup.style.display = 'none';
            }
        });
    }
    
    // Кнопка выхода
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            logout();
        });
    }
}

// Обновить селект сотрудников для страницы входа
function setupEmployeeSelectForLogin() {
    updateEmployeeSelectForLogin();
}

function updateEmployeeSelectForLogin() {
    const select = document.getElementById('loginEmployee');
    if (!select) return;
    
    select.innerHTML = '<option value="">Выберите сотрудника</option>';
    employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.name;
        select.appendChild(option);
    });
}

// Обработка входа
function handleLogin() {
    const role = document.getElementById('loginRole').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    if (!role) {
        showError('Выберите роль');
        return;
    }
    
    if (role === 'admin') {
        // Проверка пароля администратора
        if (password === ADMIN_PASSWORD) {
            currentUser = { role: 'admin' };
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        } else {
            showError('Неверный пароль администратора');
        }
    } else if (role === 'employee') {
        const employeeId = parseInt(document.getElementById('loginEmployee').value);
        
        if (!employeeId) {
            showError('Выберите сотрудника');
            return;
        }
        
        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee) {
            showError('Сотрудник не найден');
            return;
        }
        
        // Проверить пароль
        if (!employee.password) {
            showError('Для этого сотрудника не установлен пароль. Обратитесь к администратору.');
            return;
        }
        
        if (employee.password === password) {
            currentUser = {
                role: 'employee',
                employeeId: employeeId,
                employeeName: employee.name
            };
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            showApp();
        } else {
            showError('Неверный пароль');
        }
    }
}

// Показать ошибку
function showError(message) {
    const errorDiv = document.getElementById('loginError');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Выход из системы
function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        sessionStorage.removeItem('currentUser');
        currentUser = null;
        showLogin();
        // Очистить форму входа
        document.getElementById('loginForm').reset();
        document.getElementById('employeeSelectGroup').style.display = 'none';
    }
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Переключение вкладок
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });

    // Форма добавления сотрудника (только для администратора)
    const employeeForm = document.getElementById('employeeForm');
    if (employeeForm && currentUser && currentUser.role === 'admin') {
        employeeForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addEmployee();
        });
    }

    // Форма добавления смены (только для администратора)
    const shiftForm = document.getElementById('shiftForm');
    if (shiftForm && currentUser && currentUser.role === 'admin') {
        shiftForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addShift();
        });
    }

    // Навигация по календарю
    const prevMonth = document.getElementById('prevMonth');
    const nextMonth = document.getElementById('nextMonth');
    if (prevMonth) {
        prevMonth.addEventListener('click', () => {
            changeMonth(-1);
        });
    }
    if (nextMonth) {
        nextMonth.addEventListener('click', () => {
            changeMonth(1);
        });
    }

    // Генерация отчёта
    const generateReportBtn = document.getElementById('generateReport');
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', () => {
            generateReport();
        });
    }
}

// Переключение вкладок
function switchTab(tabName) {
    // Убрать активный класс со всех вкладок и контента
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Добавить активный класс выбранной вкладке и контенту
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');

    // Обновить календарь если открыта вкладка календаря
    if (tabName === 'calendar') {
        updateCalendar();
    }
}

// Добавление сотрудника
function addEmployee() {
    if (currentUser.role !== 'admin') {
        alert('Только администратор может добавлять сотрудников');
        return;
    }
    
    const nameInput = document.getElementById('employeeName');
    const passwordInput = document.getElementById('employeePassword');
    const name = nameInput.value.trim();
    const password = passwordInput.value;

    if (!name) {
        alert('Пожалуйста, введите имя сотрудника');
        return;
    }

    if (!password) {
        alert('Пожалуйста, установите пароль для сотрудника');
        return;
    }

    // Проверить, не существует ли уже такой сотрудник
    if (employees.find(emp => emp.name.toLowerCase() === name.toLowerCase())) {
        alert('Сотрудник с таким именем уже существует');
        return;
    }

    const employee = {
        id: Date.now(),
        name: name,
        password: password
    };

    employees.push(employee);
    saveEmployees();
    renderEmployees();
    renderPasswordManagement();
    updateEmployeeSelects();
    updateEmployeeSelectForLogin();
    nameInput.value = '';
    passwordInput.value = '';
}

// Функция saveEmployees уже определена выше в коде для работы с Firebase

// Отображение списка сотрудников
function renderEmployees() {
    const container = document.getElementById('employeesList');
    if (!container) return;
    
    if (currentUser.role !== 'admin') {
        container.innerHTML = '<div class="list-item empty">Доступ ограничен</div>';
        return;
    }
    
    if (employees.length === 0) {
        container.innerHTML = '<div class="list-item empty">Нет сотрудников. Добавьте первого сотрудника.</div>';
        return;
    }

    container.innerHTML = employees.map(emp => `
        <div class="list-item">
            <div>
                <strong>${emp.name}</strong>
            </div>
            <button class="btn btn-danger" onclick="deleteEmployee(${emp.id})">Удалить</button>
        </div>
    `).join('');
}

// Отображение управления паролями
function renderPasswordManagement() {
    const container = document.getElementById('passwordManagementList');
    if (!container) return;
    
    if (currentUser.role !== 'admin') {
        return;
    }
    
    if (employees.length === 0) {
        container.innerHTML = '<div class="list-item empty">Нет сотрудников</div>';
        return;
    }

    container.innerHTML = employees.map(emp => `
        <div class="list-item">
            <div>
                <strong>${emp.name}</strong><br>
                <span style="color: var(--text-light); font-size: 14px;">
                    ${emp.password ? 'Пароль установлен' : 'Пароль не установлен'}
                </span>
            </div>
            <button class="btn btn-change-password" onclick="changeEmployeePassword(${emp.id})">
                ${emp.password ? 'Изменить пароль' : 'Установить пароль'}
            </button>
        </div>
    `).join('');
}

// Изменение пароля сотрудника
function changeEmployeePassword(employeeId) {
    if (currentUser.role !== 'admin') {
        alert('Только администратор может изменять пароли');
        return;
    }
    
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
        alert('Сотрудник не найден');
        return;
    }
    
    const newPassword = prompt(`Введите новый пароль для ${employee.name}:`);
    if (newPassword === null) {
        return; // Пользователь отменил
    }
    
    if (!newPassword || newPassword.trim() === '') {
        alert('Пароль не может быть пустым');
        return;
    }
    
    employee.password = newPassword.trim();
    saveEmployees();
    renderPasswordManagement();
    alert('Пароль успешно изменен');
}

// Удаление сотрудника
function deleteEmployee(id) {
    if (confirm('Вы уверены, что хотите удалить этого сотрудника? Все связанные смены также будут удалены.')) {
        employees = employees.filter(emp => emp.id !== id);
        shifts = shifts.filter(shift => shift.employeeId !== id);
        saveEmployees();
        saveShifts();
        renderEmployees();
        renderPasswordManagement();
        renderShifts();
        updateEmployeeSelects();
        updateEmployeeSelectForLogin();
        updateCalendar();
    }
}

// Обновление селектов с сотрудниками
function updateEmployeeSelects() {
    const shiftSelect = document.getElementById('shiftEmployee');
    const reportSelect = document.getElementById('reportEmployee');
    
    // Селект для смен (только администратор)
    if (shiftSelect && currentUser && currentUser.role === 'admin') {
        const currentValue = shiftSelect.value;
        shiftSelect.innerHTML = '<option value="">Выберите сотрудника</option>';
        employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.name;
            shiftSelect.appendChild(option);
        });
        if (currentValue) {
            shiftSelect.value = currentValue;
        }
    }
    
    // Селект для отчетов
    if (reportSelect) {
        const currentValue = reportSelect.value;
        
        if (currentUser.role === 'employee') {
            // Для сотрудника показывать только его
            reportSelect.innerHTML = '';
            const employee = employees.find(emp => emp.id === currentUser.employeeId);
            if (employee) {
                const option = document.createElement('option');
                option.value = employee.id;
                option.textContent = employee.name;
                reportSelect.appendChild(option);
                reportSelect.value = employee.id;
            }
        } else {
            // Для администратора показывать всех
            reportSelect.innerHTML = '<option value="all">Все сотрудники</option>';
            employees.forEach(emp => {
                const option = document.createElement('option');
                option.value = emp.id;
                option.textContent = emp.name;
                reportSelect.appendChild(option);
            });
            if (currentValue) {
                reportSelect.value = currentValue;
            }
        }
    }
}

// Добавление смены
function addShift() {
    if (currentUser.role !== 'admin') {
        alert('Только администратор может добавлять смены');
        return;
    }
    const employeeId = parseInt(document.getElementById('shiftEmployee').value);
    const date = document.getElementById('shiftDate').value;
    const start = document.getElementById('shiftStart').value;
    const end = document.getElementById('shiftEnd').value;

    if (!employeeId) {
        alert('Пожалуйста, выберите сотрудника');
        return;
    }

    if (!date) {
        alert('Пожалуйста, выберите дату');
        return;
    }

    // Проверка времени
    if (start < SHIFT_START_LIMIT || start > SHIFT_END_LIMIT) {
        alert(`Время начала смены должно быть между ${SHIFT_START_LIMIT} и ${SHIFT_END_LIMIT}`);
        return;
    }

    if (end < SHIFT_START_LIMIT || end > SHIFT_END_LIMIT) {
        alert(`Время окончания смены должно быть между ${SHIFT_START_LIMIT} и ${SHIFT_END_LIMIT}`);
        return;
    }

    if (start >= end) {
        alert('Время окончания должно быть позже времени начала');
        return;
    }

    // Проверка для редактирования или создания новой смены
    const shiftIdField = document.getElementById('shiftId');
    const isEditing = shiftIdField && shiftIdField.value;
    
    if (isEditing) {
        // Редактирование существующей смены
        const shiftId = parseInt(shiftIdField.value);
        const shiftIndex = shifts.findIndex(s => s.id === shiftId);
        
        if (shiftIndex !== -1) {
            // Проверить, не конфликтует ли с другой сменой (кроме текущей редактируемой)
            const conflictingShift = shifts.find(s => 
                s.id !== shiftId && 
                s.employeeId === employeeId && 
                s.date === date
            );
            
            if (conflictingShift) {
                alert('У этого сотрудника уже есть другая смена в этот день. Выберите другую дату или сотрудника.');
                return;
            }
            
            // Обновляем смену
            shifts[shiftIndex] = {
                id: shiftId,
                employeeId: employeeId,
                date: date,
                start: start,
                end: end
            };
            
            saveShifts();
            renderShifts();
            updateCalendar();
            
            // Сброс формы редактирования
            cancelEditShift();
        }
    } else {
        // Создание новой смены
        // Проверить, нет ли уже смены для этого сотрудника в этот день
        const existingShift = shifts.find(s => 
            s.employeeId === employeeId && s.date === date
        );

        if (existingShift) {
            if (confirm('У этого сотрудника уже есть смена в этот день. Заменить?')) {
                shifts = shifts.filter(s => s.id !== existingShift.id);
            } else {
                return;
            }
        }

        const shift = {
            id: Date.now(),
            employeeId: employeeId,
            date: date,
            start: start,
            end: end
        };

        shifts.push(shift);
        saveShifts();
        renderShifts();
        updateCalendar();
        
        // Сброс формы
        resetShiftForm();
    }
}

// Сброс формы смены
function resetShiftForm() {
    const form = document.getElementById('shiftForm');
    if (form) {
        form.reset();
        document.getElementById('shiftId').value = '';
        document.getElementById('shiftDate').valueAsDate = new Date();
        document.getElementById('shiftStart').value = SHIFT_START_LIMIT;
        document.getElementById('shiftEnd').value = SHIFT_END_LIMIT;
        
        // Обновить заголовок и кнопки
        document.getElementById('shiftFormTitle').textContent = 'Добавить смену';
        document.getElementById('shiftSubmitBtn').textContent = 'Добавить смену';
        document.getElementById('shiftCancelBtn').style.display = 'none';
    }
}

// Отмена редактирования смены (глобальная функция для HTML)
window.cancelEditShift = function() {
    resetShiftForm();
}

// Редактирование смены (глобальная функция для HTML)
window.editShift = function(shiftId) {
    if (currentUser.role !== 'admin') {
        alert('Только администратор может редактировать смены');
        return;
    }
    
    const shift = shifts.find(s => s.id === shiftId);
    if (!shift) {
        alert('Смена не найдена');
        return;
    }
    
    // Заполняем форму данными смены
    document.getElementById('shiftId').value = shift.id;
    document.getElementById('shiftEmployee').value = shift.employeeId;
    document.getElementById('shiftDate').value = shift.date;
    document.getElementById('shiftStart').value = shift.start;
    document.getElementById('shiftEnd').value = shift.end;
    
    // Обновляем заголовок и кнопки
    document.getElementById('shiftFormTitle').textContent = 'Редактировать смену';
    document.getElementById('shiftSubmitBtn').textContent = 'Сохранить изменения';
    document.getElementById('shiftCancelBtn').style.display = 'block';
    
    // Прокрутить к форме
    document.getElementById('shiftForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Функция saveShifts уже определена выше в коде для работы с Firebase

// Отображение списка смен
function renderShifts() {
    const container = document.getElementById('shiftsList');
    if (!container) return;
    
    if (currentUser.role !== 'admin') {
        container.innerHTML = '<div class="list-item empty">Доступ ограничен</div>';
        return;
    }
    
    if (shifts.length === 0) {
        container.innerHTML = '<div class="list-item empty">Нет смен. Добавьте первую смену.</div>';
        return;
    }

    // Сортировка по дате (новые сначала)
    const sortedShifts = [...shifts].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sortedShifts.map(shift => {
        const employee = employees.find(emp => emp.id === shift.employeeId);
        const hours = calculateHours(shift.start, shift.end);
        const earnings = calculateEarnings(hours);
        const shiftId = shift.id;

        return `
            <div class="list-item">
                <div>
                    <strong>${employee ? employee.name : 'Неизвестный сотрудник'}</strong><br>
                    <span style="color: var(--text-light);">${formatDate(shift.date)}</span><br>
                    <span style="color: var(--primary-blue);">${shift.start} - ${shift.end}</span><br>
                    <span style="color: var(--primary-pink); font-weight: bold;">${hours.toFixed(2)} ч. × ${HOURLY_RATE} ₽ = ${earnings.toFixed(2)} ₽</span>
                </div>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-change-password" onclick="window.editShift && window.editShift(${shiftId})">✏️ Редактировать</button>
                    <button class="btn btn-danger" onclick="window.deleteShift && window.deleteShift(${shiftId})">🗑️ Удалить</button>
                </div>
            </div>
        `;
    }).join('');
}

// Удаление смены (глобальная функция для HTML)
window.deleteShift = function(id) {
    if (confirm('Вы уверены, что хотите удалить эту смену?')) {
        shifts = shifts.filter(shift => shift.id !== id);
        saveShifts();
        renderShifts();
        updateCalendar();
    }
}

// Расчет часов работы
function calculateHours(start, end) {
    const startParts = start.split(':');
    const endParts = end.split(':');
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    return (endMinutes - startMinutes) / 60;
}

// Расчет заработка
function calculateEarnings(hours) {
    return hours * HOURLY_RATE;
}

// Форматирование даты
function formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const months = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 
                    'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];
    
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}, ${days[date.getDay()]}`;
}

// Календарь
let currentCalendarDate = new Date();

function updateCalendar() {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Установить заголовок месяца
    const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                       'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    document.getElementById('currentMonth').textContent = `${monthNames[month]} ${year}`;

    // Получить первый день месяца и количество дней
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = воскресенье

    // Заголовки дней недели
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    let calendarHTML = dayNames.map(day => 
        `<div style="text-align: center; font-weight: bold; color: var(--primary-blue); padding: 10px;">${day}</div>`
    ).join('');

    // Пустые ячейки до первого дня месяца
    for (let i = 0; i < startingDayOfWeek; i++) {
        calendarHTML += '<div class="calendar-day other-month"></div>';
    }

    // Дни месяца
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayShifts = shifts.filter(s => s.date === dateStr);
        
        let dayHTML = `<div class="calendar-day">`;
        dayHTML += `<div class="calendar-day-number">${day}</div>`;
        
        if (dayShifts.length > 0) {
            dayShifts.forEach(shift => {
                const employee = employees.find(emp => emp.id === shift.employeeId);
                const hours = calculateHours(shift.start, shift.end);
                const earnings = calculateEarnings(hours);
                const colorClass = shift.employeeId % 2 === 0 ? '' : 'pink';
                
                dayHTML += `<span class="shift-info ${colorClass}" title="${employee ? employee.name : 'Неизвестный'}: ${shift.start}-${shift.end}, ${earnings.toFixed(0)} ₽">`;
                dayHTML += `${employee ? employee.name.substring(0, 10) : 'Н/Д'}: ${shift.start}-${shift.end}`;
                dayHTML += `</span>`;
            });
        }
        
        dayHTML += `</div>`;
        calendarHTML += dayHTML;
    }

    // Заполнить оставшиеся ячейки до конца недели
    const totalCells = startingDayOfWeek + daysInMonth;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
        for (let i = 0; i < remainingCells; i++) {
            calendarHTML += '<div class="calendar-day other-month"></div>';
        }
    }

    document.getElementById('calendarContainer').innerHTML = calendarHTML;
}

// Изменение месяца в календаре
function changeMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    updateCalendar();
}

// Настройка фильтров отчёта
function setupReportFilters() {
    updateEmployeeSelects();
}

// Генерация отчёта
function generateReport() {
    const reportEmployeeSelect = document.getElementById('reportEmployee');
    if (!reportEmployeeSelect) return;
    
    let employeeId = reportEmployeeSelect.value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;

    // Для сотрудников ограничить только своими сменами
    if (currentUser.role === 'employee') {
        employeeId = currentUser.employeeId.toString();
    }

    let filteredShifts = [...shifts];

    // Фильтр по сотруднику
    if (employeeId !== 'all') {
        filteredShifts = filteredShifts.filter(s => s.employeeId === parseInt(employeeId));
    }

    // Фильтр по датам
    if (startDate) {
        filteredShifts = filteredShifts.filter(s => s.date >= startDate);
    }
    if (endDate) {
        filteredShifts = filteredShifts.filter(s => s.date <= endDate);
    }

    if (filteredShifts.length === 0) {
        document.getElementById('reportContent').innerHTML = 
            '<p class="placeholder">Нет данных за выбранный период</p>';
        return;
    }

    // Группировка по сотрудникам
    const reportByEmployee = {};
    
    filteredShifts.forEach(shift => {
        const employeeId = shift.employeeId;
        if (!reportByEmployee[employeeId]) {
            reportByEmployee[employeeId] = {
                employee: employees.find(emp => emp.id === employeeId),
                shifts: [],
                totalHours: 0,
                totalEarnings: 0,
                daysWorked: 0
            };
        }

        const hours = calculateHours(shift.start, shift.end);
        const earnings = calculateEarnings(hours);

        reportByEmployee[employeeId].shifts.push({
            ...shift,
            hours,
            earnings
        });

        reportByEmployee[employeeId].totalHours += hours;
        reportByEmployee[employeeId].totalEarnings += earnings;
        reportByEmployee[employeeId].daysWorked += 1;
    });

    // Общая статистика
    let totalHoursAll = 0;
    let totalEarningsAll = 0;
    let totalDaysAll = 0;

    Object.values(reportByEmployee).forEach(data => {
        totalHoursAll += data.totalHours;
        totalEarningsAll += data.totalEarnings;
        totalDaysAll += data.daysWorked;
    });

    // Генерация HTML отчёта
    let reportHTML = '';

    // Общая статистика
    if (employeeId === 'all') {
        reportHTML += `
            <div class="report-item" style="background: linear-gradient(135deg, var(--primary-blue) 0%, var(--primary-pink) 100%); color: white; border: none;">
                <h3 style="color: white;">Общая статистика</h3>
                <div class="report-stats">
                    <div class="stat-box" style="background: rgba(255,255,255,0.2);">
                        <div class="stat-value" style="color: white;">${totalDaysAll}</div>
                        <div class="stat-label">Дней отработано</div>
                    </div>
                    <div class="stat-box" style="background: rgba(255,255,255,0.2);">
                        <div class="stat-value" style="color: white;">${totalHoursAll.toFixed(2)}</div>
                        <div class="stat-label">Часов отработано</div>
                    </div>
                    <div class="stat-box" style="background: rgba(255,255,255,0.2);">
                        <div class="stat-value" style="color: white;">${totalEarningsAll.toFixed(2)} ₽</div>
                        <div class="stat-label">Всего заработано</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Отчёты по сотрудникам
    Object.values(reportByEmployee).forEach(data => {
        const employee = data.employee;
        if (!employee) return;

        reportHTML += `
            <div class="report-item">
                <h3>${employee.name}</h3>
                <div class="report-stats">
                    <div class="stat-box">
                        <div class="stat-value">${data.daysWorked}</div>
                        <div class="stat-label">Дней отработано</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${data.totalHours.toFixed(2)}</div>
                        <div class="stat-label">Часов отработано</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${data.totalEarnings.toFixed(2)} ₽</div>
                        <div class="stat-label">Всего заработано</div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <strong>Детализация по дням:</strong>
                    <div style="margin-top: 10px;">
                        ${data.shifts.map(shift => `
                            <div style="padding: 10px; margin: 5px 0; background: var(--light-pink); border-radius: 5px; border-left: 3px solid var(--primary-pink);">
                                <strong>${formatDate(shift.date)}</strong><br>
                                Время: ${shift.start} - ${shift.end}<br>
                                Отработано: ${shift.hours.toFixed(2)} ч.<br>
                                Заработано: <strong style="color: var(--primary-pink);">${shift.earnings.toFixed(2)} ₽</strong>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    });

    document.getElementById('reportContent').innerHTML = reportHTML;
}

