import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, query, where, onSnapshot, addDoc, deleteDoc } from 'firebase/firestore';
import { ChevronLeft, ChevronRight, Plus, Settings, Trash2, Save, ChevronDown, Copy } from 'lucide-react';

// --- НАСТРОЙКИ FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-bju-app';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- ИНИЦИАЛИЗАЦИЯ FIREBASE ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ОСНОВНОЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ ---
export default function App() {
    const [page, setPage] = useState('main'); // 'main', 'add', 'settings'
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthReady(true);
            } else {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (error) {
                    console.error("Ошибка входа:", error);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    const navigate = (pageName) => setPage(pageName);

    if (!isAuthReady) {
        return <div className="flex items-center justify-center h-screen bg-gray-900 text-white">Загрузка...</div>;
    }

    return (
        <div className="bg-gray-900 min-h-screen text-white font-sans">
            <div className="container mx-auto max-w-lg p-4 pb-24">
                {page === 'main' && <MainPage navigate={navigate} userId={userId} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
                {page === 'add' && <AddFoodPage navigate={navigate} userId={userId} selectedDate={selectedDate} />}
                {page === 'settings' && <SettingsPage navigate={navigate} userId={userId} />}
            </div>
        </div>
    );
}

// --- КОМПОНЕНТ КАЛЕНДАРЯ ---
function Calendar({ selectedDate, onDateChange }) {
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

    const changeMonth = (amount) => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
    };

    const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const emptyDays = Array.from({ length: (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1) });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthName = currentMonth.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
                <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronLeft /></button>
                <h3 className="font-bold text-lg capitalize">{monthName}</h3>
                <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-700"><ChevronRight /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <div key={day} className="font-semibold text-gray-400">{day}</div>)}
                {emptyDays.map((_, i) => <div key={`empty-${i}`}></div>)}
                {days.map(day => {
                    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                    const isSelected = selectedDate.getTime() === date.getTime();
                    const isToday = today.getTime() === date.getTime();

                    let dayClass = "w-9 h-9 flex items-center justify-center rounded-full cursor-pointer transition-colors ";
                    if (isSelected) {
                        dayClass += "bg-cyan-500 text-white font-bold";
                    } else if (isToday) {
                        dayClass += "bg-gray-700 text-cyan-400";
                    } else {
                        dayClass += "hover:bg-gray-700";
                    }

                    return (
                        <div key={day} className={dayClass} onClick={() => onDateChange(date)}>
                            {day}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// --- КОМПОНЕНТ ГЛАВНОЙ СТРАНИЦЫ ---
function MainPage({ navigate, userId, selectedDate, setSelectedDate }) {
    const [goals, setGoals] = useState({ proteins: 200, fats: 80, carbs: 300, calories: 2720 });
    const [foods, setFoods] = useState([]);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const selectedDateString = selectedDate.toISOString().split('T')[0];

    useEffect(() => {
        if (!userId) return;
        const goalsDocRef = doc(db, `artifacts/${appId}/users/${userId}/settings`, 'dailyGoals');
        const unsubscribeGoals = onSnapshot(goalsDocRef, (docSnap) => {
            if (docSnap.exists()) {
                setGoals(docSnap.data());
            }
        });

        const foodsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/foods`);
        const q = query(foodsCollectionRef, where("date", "==", selectedDateString));
        const unsubscribeFoods = onSnapshot(q, (querySnapshot) => {
            const foodsData = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Конвертируем временную метку Firestore в объект Date
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0)
                };
            });
            // Сортируем по дате создания в обратном порядке (новые сверху)
            foodsData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            setFoods(foodsData);
        });

        return () => {
            unsubscribeGoals();
            unsubscribeFoods();
        };
    }, [userId, selectedDateString]);

    const totals = foods.reduce((acc, food) => {
        acc.proteins += food.proteins;
        acc.fats += food.fats;
        acc.carbs += food.carbs;
        acc.calories += food.calories;
        return acc;
    }, { proteins: 0, fats: 0, carbs: 0, calories: 0 });

    const deleteFood = async (foodId) => {
        if (!userId) return;
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/foods`, foodId));
        } catch (error) {
            console.error("Ошибка удаления:", error);
        }
    };

    const repeatFood = async (foodToRepeat) => {
        if (!userId) return;
        const newFoodEntry = {
            name: foodToRepeat.name,
            grams: foodToRepeat.grams,
            proteins: foodToRepeat.proteins,
            fats: foodToRepeat.fats,
            carbs: foodToRepeat.carbs,
            calories: foodToRepeat.calories,
            date: new Date().toISOString().split('T')[0], // Всегда добавляем на сегодня
            createdAt: new Date() // Добавляем временную метку
        };
        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/foods`), newFoodEntry);
        } catch (error) {
            console.error("Ошибка повторения записи:", error);
        }
    };

    const handleDateChange = (date) => {
        setSelectedDate(new Date(date.setHours(0, 0, 0, 0)));
        setIsCalendarOpen(false);
    }

    const titleDate = selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="flex flex-col gap-6">
            <header className="flex justify-between items-center">
                <button onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="flex items-center gap-2 text-xl md:text-2xl font-bold text-cyan-400 hover:text-cyan-300 transition-colors text-left">
                    <span>{titleDate}</span>
                    <ChevronDown className={`w-6 h-6 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
                </button>
                <button onClick={() => navigate('settings')} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors">
                    <Settings className="w-6 h-6" />
                </button>
            </header>

            {isCalendarOpen && <Calendar selectedDate={selectedDate} onDateChange={handleDateChange} />}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <StatCard label="Калории" value={totals.calories.toFixed(0)} goal={goals.calories} unit="ккал" color="text-yellow-400" />
                <StatCard label="Белки" value={totals.proteins.toFixed(0)} goal={goals.proteins} unit="г" color="text-red-400" />
                <StatCard label="Жиры" value={totals.fats.toFixed(0)} goal={goals.fats} unit="г" color="text-green-400" />
                <StatCard label="Углеводы" value={totals.carbs.toFixed(0)} goal={goals.carbs} unit="г" color="text-blue-400" />
            </div>
            <div>
                <h2 className="text-2xl font-semibold mb-4">Приемы пищи</h2>
                <div className="space-y-3">
                    {foods.length > 0 ? (
                        foods.map(food => <FoodItem key={food.id} food={food} onDelete={() => deleteFood(food.id)} onRepeat={() => repeatFood(food)} />)
                    ) : (
                        <p className="text-gray-400 text-center py-8">Нет записей за этот день.</p>
                    )}
                </div>
            </div>
            <div className="fixed bottom-6 right-6 z-10">
                <button onClick={() => navigate('add')} className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-5 rounded-full shadow-lg transition-transform transform hover:scale-105">
                    <Plus className="w-6 h-6" />
                    <span>Добавить</span>
                </button>
            </div>
        </div>
    );
}

// --- КОМПОНЕНТ КАРТОЧКИ СТАТИСТИКИ ---
function StatCard({ label, value, goal, unit, color }) {
    const percentage = goal > 0 ? (value / goal) * 100 : 0;
    return (
        <div className="bg-gray-800 p-4 rounded-xl shadow-md">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-sm text-gray-400">{label}</p>
            <p className="text-xs text-gray-500">Цель: {goal} {unit}</p>
            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                <div className="bg-cyan-400 h-1.5 rounded-full" style={{ width: `${Math.min(percentage, 100)}%` }}></div>
            </div>
        </div>
    );
}

// --- КОМПОНЕНТ ЭЛЕМЕНТА СПИСКА ЕДЫ ---
function FoodItem({ food, onDelete, onRepeat }) {
    return (
        <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between shadow">
            <div>
                <h3 className="font-bold text-lg capitalize">{food.name}</h3>
                <p className="text-sm text-gray-400">{food.grams} г · {food.calories.toFixed(0)} ккал</p>
            </div>
            <div className="flex items-center gap-2">
                <div className="text-right text-sm">
                    <p><span className="text-red-400">Б:</span> {food.proteins.toFixed(1)} г</p>
                    <p><span className="text-green-400">Ж:</span> {food.fats.toFixed(1)} г</p>
                    <p><span className="text-blue-400">У:</span> {food.carbs.toFixed(1)} г</p>
                </div>
                <button onClick={onRepeat} className="p-2 rounded-full text-gray-500 hover:text-cyan-400 hover:bg-gray-700 transition-colors" title="Повторить сегодня">
                    <Copy className="w-5 h-5" />
                </button>
                <button onClick={onDelete} className="p-2 rounded-full text-gray-500 hover:text-red-500 hover:bg-gray-700 transition-colors" title="Удалить">
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

// --- КОМПОНЕНТ СТРАНИЦЫ НАСТРОЕК ---
function SettingsPage({ navigate, userId }) {
    const [goals, setGoals] = useState({ proteins: 200, fats: 80, carbs: 300, calories: 2720 });

    const goalsDocRef = useCallback(() => {
        if (!userId) return null;
        return doc(db, `artifacts/${appId}/users/${userId}/settings`, 'dailyGoals');
    }, [userId]);

    useEffect(() => {
        const ref = goalsDocRef();
        if (!ref) return;
        getDoc(ref).then(docSnap => {
            if (docSnap.exists()) {
                setGoals(docSnap.data());
            }
        });
    }, [goalsDocRef]);

    useEffect(() => {
        const { proteins, fats, carbs } = goals;
        const calculatedCalories = (proteins * 4) + (fats * 9) + (carbs * 4);
        setGoals(g => ({ ...g, calories: calculatedCalories }));
    }, [goals.proteins, goals.fats, goals.carbs]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setGoals(prev => ({ ...prev, [name]: Number(value) }));
    };

    const handleSave = async () => {
        const ref = goalsDocRef();
        if (!ref) return;
        try {
            await setDoc(ref, goals);
            navigate('main');
        } catch (error) {
            console.error("Ошибка сохранения настроек:", error);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <header className="flex items-center">
                <button onClick={() => navigate('main')} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors mr-4">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold text-cyan-400">Настройки</h1>
            </header>
            <div className="space-y-6 bg-gray-800 p-6 rounded-lg">
                <div className="text-center bg-gray-900/50 p-4 rounded-lg">
                    <p className="text-sm text-gray-400">Расчетная цель по калориям</p>
                    <p className="text-3xl font-bold text-yellow-400">{goals.calories.toFixed(0)} ккал</p>
                </div>
                <SliderGroup label="Цель по белкам (г)" name="proteins" value={goals.proteins} onChange={handleChange} min="0" max="400" step="1" />
                <SliderGroup label="Цель по жирам (г)" name="fats" value={goals.fats} onChange={handleChange} min="0" max="300" step="1" />
                <SliderGroup label="Цель по углеводам (г)" name="carbs" value={goals.carbs} onChange={handleChange} min="0" max="600" step="1" />
            </div>
            <button onClick={handleSave} className="flex items-center justify-center gap-2 w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-5 rounded-lg shadow-lg transition-transform transform hover:scale-105">
                <Save className="w-5 h-5" />
                <span>Сохранить</span>
            </button>
        </div>
    );
}

// --- КОМПОНЕНТ СЛАЙДЕРА ---
function SliderGroup({ label, name, value, onChange, min, max, step }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-1">
                <label htmlFor={name} className="text-sm font-medium text-gray-300">{label}</label>
                <span className="text-sm font-bold text-cyan-400">{value}</span>
            </div>
            <input
                type="range"
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                min={min}
                max={max}
                step={step}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer range-thumb"
            />
        </div>
    );
}

// --- КОМПОНЕНТ СТРАНИЦЫ ДОБАВЛЕНИЯ ЕДЫ ---
function AddFoodPage({ navigate, userId, selectedDate }) {
    const [name, setName] = useState('');
    const [grams, setGrams] = useState(100);
    const [proteins100, setProteins100] = useState(20);
    const [fats100, setFats100] = useState(5);
    const [carbs100, setCarbs100] = useState(0);

    const handleSave = async () => {
        if (!userId || !name || grams <= 0) {
            console.warn("Пожалуйста, заполните название и вес продукта.");
            return;
        }

        const multiplier = grams / 100;
        const finalProteins = proteins100 * multiplier;
        const finalFats = fats100 * multiplier;
        const finalCarbs = carbs100 * multiplier;
        const finalCalories = (finalProteins * 4) + (finalFats * 9) + (finalCarbs * 4);

        const foodData = {
            name: name.toLowerCase(),
            grams: Number(grams),
            proteins: finalProteins,
            fats: finalFats,
            carbs: finalCarbs,
            calories: finalCalories,
            date: selectedDate.toISOString().split('T')[0],
            createdAt: new Date() // Добавляем временную метку
        };

        try {
            await addDoc(collection(db, `artifacts/${appId}/users/${userId}/foods`), foodData);
            navigate('main');
        } catch (error) {
            console.error("Ошибка добавления еды:", error);
        }
    };

    const calculatedCalories = ((proteins100 * 4) + (fats100 * 9) + (carbs100 * 4)) * (grams / 100);

    return (
        <div className="flex flex-col gap-6">
            <header className="flex items-center">
                <button onClick={() => navigate('main')} className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors mr-4">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <h1 className="text-3xl font-bold text-cyan-400">Добавить прием пищи</h1>
            </header>

            <div className="space-y-6 bg-gray-800 p-6 rounded-lg">
                <div>
                    <label htmlFor="name" className="block mb-1 text-sm font-medium text-gray-300">Название продукта</label>
                    <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-cyan-500 focus:border-cyan-500 transition"
                        placeholder="Например, куриная грудка"
                    />
                </div>

                <SliderGroup label="Вес (граммы)" name="grams" value={grams} onChange={(e) => setGrams(Number(e.target.value))} min="0" max="1000" step="5" />

                <div className="pt-4 border-t border-gray-700">
                    <h3 className="text-lg font-semibold mb-2">БЖУ на 100 грамм</h3>
                    <div className="space-y-4">
                        <SliderGroup label="Белки (г)" name="proteins100" value={proteins100} onChange={(e) => setProteins100(Number(e.target.value))} min="0" max="100" step="0.1" />
                        <SliderGroup label="Жиры (г)" name="fats100" value={fats100} onChange={(e) => setFats100(Number(e.target.value))} min="0" max="100" step="0.1" />
                        <SliderGroup label="Углеводы (г)" name="carbs100" value={carbs100} onChange={(e) => setCarbs100(Number(e.target.value))} min="0" max="100" step="0.1" />
                    </div>
                </div>
                <div className="text-center bg-gray-900/50 p-4 rounded-lg mt-4">
                    <p className="text-sm text-gray-400">Итого калорий</p>
                    <p className="text-3xl font-bold text-yellow-400">{calculatedCalories.toFixed(0)} ккал</p>
                </div>
            </div>

            <button onClick={handleSave} className="flex items-center justify-center gap-2 w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-5 rounded-lg shadow-lg transition-transform transform hover:scale-105">
                <Save className="w-5 h-5" />
                <span>Сохранить</span>
            </button>
        </div>
    );
}
