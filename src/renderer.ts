import { createApp } from 'vue';
import { createWebHashHistory, createRouter } from 'vue-router';
import App from './App.vue';
import './index.css';

const routes = [
    {
        path: '/',
        component: () => import('./views/HomeView.vue'),
    },
    {
        path: '/new-session',
        component: () => import('./views/NewSession.vue'),
    },
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

createApp(App).use(router).mount('#app');