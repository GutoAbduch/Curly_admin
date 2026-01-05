// src/config/plans.js

export const PLAN_LIMITS = {
    Starter: {
        label: 'Starter (Básico)',
        maxEmployees: 3, // Limite de funcionários (Não conta o Admin)
        modules: ['agenda', 'clients', 'users'], // O que pode acessar
        blocked: ['stock', 'finance'] // O que está travado
    },
    Pro: {
        label: 'Pro (Intermédio)',
        maxEmployees: 5,
        modules: ['agenda', 'clients', 'stock', 'users'],
        blocked: ['finance']
    },
    Black: {
        label: 'Black (Premium)',
        maxEmployees: 9999, // Ilimitado
        modules: ['agenda', 'clients', 'stock', 'finance', 'users'],
        blocked: []
    }
};

// Função auxiliar para verificar se o plano permite acesso a um módulo
export const canAccess = (currentPlan, moduleName) => {
    // Se o plano não for definido, assume Starter como segurança
    const plan = PLAN_LIMITS[currentPlan || 'Starter']; 
    
    // Se não achou o plano (erro de digitação no banco), bloqueia por segurança ou cai no Starter
    if (!plan) return false;

    // Plano Black libera tudo irrestritamente
    if (currentPlan === 'Black') return true;

    // Verifica se o módulo está na lista de permitidos
    return plan.modules.includes(moduleName);
};