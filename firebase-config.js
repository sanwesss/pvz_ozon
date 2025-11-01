// Конфигурация Firebase
// ВАЖНО: Замените эти значения на свои из консоли Firebase
// Инструкция по получению конфигурации в README.md

const firebaseConfig = {
    apiKey: "AIzaSyAei96pX5KCHD2wVIztFBbaV7dtKR3Lqas",
    authDomain: "pvz-ozon-shifts.firebaseapp.com",
    projectId: "pvz-ozon-shifts",
    storageBucket: "pvz-ozon-shifts.firebasestorage.app",
    messagingSenderId: "965062374019",
    appId: "1:965062374019:web:531d5f1785f65d581121b6",
    measurementId: "G-9FMR9D378L"
  };

// Инициализация Firebase
let db = null;
let useFirebase = false;

// Проверка, настроен ли Firebase
if (firebaseConfig.apiKey !== "YOUR_API_KEY" && 
    firebaseConfig.projectId !== "YOUR_PROJECT_ID") {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        useFirebase = true;
        console.log("✅ Firebase подключен");
    } catch (error) {
        console.error("❌ Ошибка инициализации Firebase:", error);
        console.log("📝 Используется локальное хранилище (localStorage)");
        useFirebase = false;
    }
} else {
    console.log("📝 Firebase не настроен. Используется локальное хранилище (localStorage)");
    console.log("💡 Для синхронизации между устройствами настройте Firebase (см. README.md)");
}

