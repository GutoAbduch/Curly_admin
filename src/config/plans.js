// src/config/plans.js

export const PLAN_LIMITS = {
    Starter: {
        label: 'Starter',
        price: 'R$ 109,90', // Valor Ajustado
        period: '/mês',
        description: 'Ideal para quem está começando.',
        maxEmployees: 3,
        // ADICIONADO 'services' aqui. Sem isso, ninguém acessa a aba de serviços.
        modules: ['agenda', 'clients', 'users', 'services', 'store'], 
        blocked: ['stock', 'finance'],
        benefits: [
            'Agenda Inteligente',
            'Gestão de Clientes',
            'Até 3 Profissionais',
            'Suporte por Email'
        ]
    },
    Pro: {
        label: 'Pro',
        price: 'R$ 159,90', // Valor Ajustado
        period: '/mês',
        description: 'Para barbearias em crescimento.',
        maxEmployees: 5,
        modules: ['agenda', 'clients', 'stock', 'users', 'services', 'store'],
        blocked: ['finance'],
        benefits: [
            'Tudo do Starter',
            'Controle de Estoque',
            'Até 5 Profissionais',
            'Relatórios Básicos'
        ],
        recommended: true
    },
    Black: {
        label: 'Black',
        price: 'R$ 209,90', // Valor Ajustado
        period: '/mês',
        description: 'Gestão completa e ilimitada.',
        maxEmployees: 9999,
        modules: ['agenda', 'clients', 'stock', 'finance', 'users', 'services', 'store'],
        blocked: [],
        benefits: [
            'Plano Pro Completo',
            'Módulo Financeiro',
            'Comissões Automáticas',
            'Equipe Ilimitada',
            'Suporte VIP via WhatsApp'
        ]
    }
};

export const canAccess = (currentPlan, moduleName) => {
    const plan = PLAN_LIMITS[currentPlan || 'Starter'];
    if (!plan) return false;
    if (currentPlan === 'Black') return true;
    return plan.modules.includes(moduleName);
};