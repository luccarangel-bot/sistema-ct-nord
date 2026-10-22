// Dados iniciais do CT NORD: planos, turmas e ajustes (sem dados pessoais).
export const SEED = {
 "planos": [
  {
   "ativo": true,
   "condicoes": "R$ 210 por mês, pago de uma vez só: R$ 2.520.",
   "criadoEm": "2026-10-13T20:45:00",
   "formaPadrao": "avista",
   "id": "pl_anual",
   "meses": 12,
   "modalidade": "Livre (todas)",
   "nome": "Anual",
   "pagamentos": [
    "Pix",
    "Cartão de débito",
    "Dinheiro"
   ],
   "valor": 210
  },
  {
   "ativo": true,
   "condicoes": "O aluno paga o TotalPass e faz check-in no app a cada aula. O CT recebe do TotalPass; não há mensalidade no sistema.",
   "criadoEm": "2026-10-22T12:00:00.000Z",
   "formaPadrao": "app",
   "id": "pl_totalpass",
   "meses": 12,
   "modalidade": "Livre (todas)",
   "nome": "TotalPass",
   "pagamentos": [
    "TotalPass"
   ],
   "valor": 0
  },
  {
   "ativo": true,
   "condicoes": "O aluno paga o Wellhub (antigo Gympass) e faz check-in no app a cada aula. O CT recebe do Wellhub; não há mensalidade no sistema.",
   "criadoEm": "2026-10-22T12:00:00.000Z",
   "formaPadrao": "app",
   "id": "pl_wellhub",
   "meses": 12,
   "modalidade": "Livre (todas)",
   "nome": "Wellhub (Gympass)",
   "pagamentos": [
    "Wellhub (Gympass)"
   ],
   "valor": 0
  },
  {
   "ativo": true,
   "condicoes": "Valor por pessoa. Venda um contrato para cada integrante da família.",
   "criadoEm": "2026-10-13T20:45:00",
   "formaPadrao": "mensal",
   "id": "pl_familia_2",
   "meses": 1,
   "modalidade": "Livre (todas)",
   "nome": "Família 2 pessoas",
   "pagamentos": [
    "Pix",
    "Cartão de débito",
    "Dinheiro"
   ],
   "valor": 280
  },
  {
   "ativo": true,
   "condicoes": "Valor por pessoa. Venda um contrato para cada integrante da família.",
   "criadoEm": "2026-10-13T20:45:00",
   "formaPadrao": "mensal",
   "id": "pl_familia_3",
   "meses": 1,
   "modalidade": "Livre (todas)",
   "nome": "Família 3 pessoas",
   "pagamentos": [
    "Pix",
    "Cartão de débito",
    "Dinheiro"
   ],
   "valor": 250
  },
  {
   "ativo": true,
   "condicoes": "Valor por pessoa. Venda um contrato para cada integrante da família.",
   "criadoEm": "2026-10-13T20:45:00",
   "formaPadrao": "mensal",
   "id": "pl_familia_4",
   "meses": 1,
   "modalidade": "Livre (todas)",
   "nome": "Família 4 pessoas",
   "pagamentos": [
    "Pix",
    "Cartão de débito",
    "Dinheiro"
   ],
   "valor": 210
  },
  {
   "ativo": true,
   "condicoes": "Pagamento mensal no cartão de crédito.",
   "criadoEm": "2026-10-13T20:45:00",
   "formaPadrao": "cartao",
   "id": "pl_mensal_credito",
   "meses": 1,
   "modalidade": "Livre (todas)",
   "nome": "Mensal no crédito",
   "pagamentos": [
    "Cartão de crédito"
   ],
   "valor": 300
  },
  {
   "ativo": true,
   "condicoes": "Pagamento mensal no débito, Pix ou dinheiro.",
   "criadoEm": "2026-10-13T20:45:00",
   "formaPadrao": "mensal",
   "id": "pl_mensal_pix",
   "meses": 1,
   "modalidade": "Livre (todas)",
   "nome": "Mensal no débito, Pix ou dinheiro",
   "pagamentos": [
    "Pix",
    "Cartão de débito",
    "Dinheiro"
   ],
   "valor": 280
  },
  {
   "ativo": true,
   "condicoes": "Cobrança mensal em débito automático. As 12 mensalidades são geradas na venda; ao cancelar o contrato, as futuras são canceladas.",
   "criadoEm": "2026-10-13T20:45:00",
   "formaPadrao": "mensal",
   "id": "pl_recorrencia",
   "meses": 12,
   "modalidade": "Livre (todas)",
   "nome": "Recorrência (débito automático)",
   "pagamentos": [
    "Débito automático"
   ],
   "valor": 250
  },
  {
   "ativo": true,
   "condicoes": "R$ 230 por mês, pago de uma vez só: R$ 1.380.",
   "criadoEm": "2026-10-13T20:45:00",
   "formaPadrao": "avista",
   "id": "pl_semestral",
   "meses": 6,
   "modalidade": "Livre (todas)",
   "nome": "Semestral",
   "pagamentos": [
    "Pix",
    "Cartão de débito",
    "Dinheiro"
   ],
   "valor": 230
  }
 ],
 "turmas": [
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    2,
    4
   ],
   "fim": "08:00",
   "id": "tu_fem_0700",
   "inicio": "07:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu Fem",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    2,
    4
   ],
   "fim": "19:00",
   "id": "tu_fem_1800",
   "inicio": "18:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu Fem",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    3
   ],
   "fim": "08:30",
   "id": "tu_jj_0730",
   "inicio": "07:30",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    2,
    4
   ],
   "fim": "09:00",
   "id": "tu_jj_0800",
   "inicio": "08:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    2,
    3,
    4,
    5
   ],
   "fim": "13:00",
   "id": "tu_jj_1200",
   "inicio": "12:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    3,
    5
   ],
   "fim": "16:00",
   "id": "tu_jj_1500",
   "inicio": "15:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    2,
    3,
    4,
    5
   ],
   "fim": "18:00",
   "id": "tu_jj_1700",
   "inicio": "17:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    2,
    4
   ],
   "fim": "20:00",
   "id": "tu_jj_1900",
   "inicio": "19:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    3
   ],
   "fim": "21:00",
   "id": "tu_jj_2000",
   "inicio": "20:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    2,
    4
   ],
   "fim": "22:00",
   "id": "tu_jj_2100",
   "inicio": "21:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    3
   ],
   "fim": "22:30",
   "id": "tu_jj_2130",
   "inicio": "21:30",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    3,
    5
   ],
   "fim": "20:00",
   "id": "tu_kids_1900",
   "inicio": "19:00",
   "modalidade": "Jiu-jitsu Kids",
   "nome": "Jiu-Jitsu Kids",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    3,
    5
   ],
   "fim": "10:00",
   "id": "tu_master_0900",
   "inicio": "09:00",
   "modalidade": "Jiu-jitsu",
   "nome": "Jiu-Jitsu Master",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    3,
    5
   ],
   "fim": "19:00",
   "id": "tu_mt_1800",
   "inicio": "18:00",
   "modalidade": "Muay Thai",
   "nome": "Muay Thai",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    2,
    4
   ],
   "fim": "21:00",
   "id": "tu_mt_2000",
   "inicio": "20:00",
   "modalidade": "Muay Thai",
   "nome": "Muay Thai",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    5
   ],
   "fim": "08:30",
   "id": "tu_nogi_0730",
   "inicio": "07:30",
   "modalidade": "Jiu-jitsu",
   "nome": "No Gi",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    1,
    3,
    5
   ],
   "fim": "17:00",
   "id": "tu_nogi_1600",
   "inicio": "16:00",
   "modalidade": "Jiu-jitsu",
   "nome": "No Gi",
   "professor": ""
  },
  {
   "ativa": true,
   "capacidade": 0,
   "criadoEm": "2026-10-13T19:45:00",
   "dias": [
    5
   ],
   "fim": "21:00",
   "id": "tu_nogi_2000",
   "inicio": "20:00",
   "modalidade": "Jiu-jitsu",
   "nome": "No Gi",
   "professor": ""
  }
 ],
 "config": [
  {
   "ct": {
    "nome": "CT NORD",
    "whatsapp": ""
   },
   "id": "geral"
  }
 ]
};
