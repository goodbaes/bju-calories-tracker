import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Основные стили для приложения
import App from './App'; // Импорт вашего главного компонента

// Находим корневой элемент в HTML (обычно это <div id="root">)
const root = ReactDOM.createRoot(document.getElementById('root'));

// Отрисовываем (вставляем) ваш компонент App в этот корневой элемент
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);