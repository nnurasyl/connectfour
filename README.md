# 🎮 Connect Four (Четыре в ряд)

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)
![SQLite](https://img.shields.io/badge/sqlite-%2307405e.svg?style=for-the-badge&logo=sqlite&logoColor=white)

Современная веб-версия классической игры «Четыре в ряд» с поддержкой мультиплеера в реальном времени, игрой против ИИ и красивым интерфейсом. 

## ✨ Возможности (Features)

- 🤖 **Игра против ИИ**: Два уровня сложности (Medium / Hard).
- 🌐 **Онлайн матчмейкинг**: Играй со случайными соперниками по сети с обновлением рейтинга.
- 🤝 **Игра с друзьями**: Кидай вызов друзьям по сети.
- 👤 **Гостевой режим и Авторизация**: Играй без регистрации или создай аккаунт для сохранения прогресса.
- 💬 **Real-time взаимодействие**: Мгновенные ходы и синхронизация состояния с помощью Socket.io.
- 🎨 **Современный UI**: Отзывчивый и красивый дизайн благодаря Tailwind CSS.

## 🛠 Технологический стек

### Frontend (`/client`)
- **React 19** + **TypeScript**
- **Vite** — Быстрый сборщик
- **Tailwind CSS** — Стилизация
- **Zustand** — Управление состоянием (State management)
- **Socket.io-client** — Вебсокеты для мультиплеера
- **React Router** — Маршрутизация

### Backend (`/server`)
- **Node.js**
- **Express.js** 
- **Socket.io** — Серверная часть вебсокетов
- **SQLite** — Легкая и быстрая база данных для хранения пользователей, матчей и рейтингов.

## 🚀 Установка и запуск (Local Development)

### 1. Клонирование репозитория
```bash
git clone https://github.com/nnurasyl/connectfour.git
cd connectfour
```

### 2. Установка зависимостей
Проект настроен как монорепозиторий (NPM Workspaces).
```bash
npm install
```

### 3. Запуск проекта (Frontend + Backend)
Запустите дев-сервер для клиента и сервера одновременно одной командой:
```bash
npm run dev
```

- **Клиент** будет доступен по адресу: `http://localhost:5173`
- **Сервер** API/Сокетов будет запущен на порту (обычно `http://localhost:3000`)

## 🌍 Деплой на Vercel (Frontend)

Для успешного деплоя клиентской части на **Vercel** используйте следующие настройки:
- **Root Directory:** `client`
- **Install Command:** `npm install --include=dev`
- **Build Command:** `npm run build:vercel`
- **Output Directory:** `dist`

## 📝 Разработка

### Структура проекта
```text
connectfour/
├── client/          # Frontend часть (Vite + React)
│   ├── src/         # Исходный код (компоненты, сторы, игровая логика)
│   ├── index.html   # Точка входа
│   └── package.json
├── server/          # Backend часть (Node.js + SQLite)
│   ├── src/         # Исходный код сервера и сокетов
│   ├── data/        # Файлы БД SQLite
│   └── package.json
└── package.json     # Корневой package.json (настройка workspaces)
```
