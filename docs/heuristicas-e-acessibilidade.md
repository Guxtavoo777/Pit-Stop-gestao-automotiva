# Heurísticas de Nielsen e acessibilidade

Este documento registra como a interface do Pit Stop atende às 10 heurísticas de usabilidade de Jakob Nielsen e às regras de acessibilidade adotadas no redesenho de novembro de 2026.

O redesenho atendeu a dois pedidos da professora. O primeiro foi tirar a "cara de IA": foto grande com degradê, títulos finos e seções de marketing. O segundo foi tornar o site legível para quem enxerga pouco.

## Acessibilidade

| Regra | Como foi aplicada |
| --- | --- |
| Texto grande | Texto base de 18 px; nenhum texto abaixo de 15,75 px. Antes havia rótulos de até 9 px. |
| Fonte legível | Atkinson Hyperlegible, criada pelo Braille Institute para pessoas com baixa visão. Números de placa, quilometragem e valores em fonte monoespaçada, para não confundir 0 com O. |
| Contraste | Texto principal com contraste acima de 7:1 e textos secundários acima de 4,5:1, o mínimo da WCAG 2.1 AA. O cinza `#9a9a9a`, de 2,8:1, foi retirado. |
| Tamanho ajustável | Botões A−, A e A+ no topo de todas as páginas, com quatro tamanhos; a escolha fica guardada no navegador. |
| Teclado | Foco sempre visível, com anel preto e borda amarela, e o link "Pular para o conteúdo" no início de cada página. |
| Leitor de tela | Todo campo tem rótulo ligado (`for`/`id`), o item atual do menu tem `aria-current` e as mensagens de erro usam `role="alert"`. |
| Alvos de toque | Botões com pelo menos 44 px de altura. |
| Cor não é o único sinal | Cada estado tem símbolo e texto: "✓ Em dia", "! Revisão próxima" e "✕ Revisão atrasada". |
| Movimento | Sem animações de entrada; o conteúdo aparece de uma vez. |

### Verificação

Em 05/11/2026, as 13 telas foram auditadas com o axe-core 4.10, nas regras WCAG 2.0 A e AA e WCAG 2.1 AA, em 1280 px e em 375 px de largura. Depois das correções, nenhuma violação foi encontrada, nem rolagem lateral no celular. A primeira rodada tinha encontrado 11 tipos de problema: campos sem rótulo, contraste baixo e imagens sem texto alternativo.

## As 10 heurísticas

| Heurística | Onde aparece no Pit Stop | O que ainda falta |
| --- | --- | --- |
| 1. Visibilidade do estado do sistema | A situação de cada carro aparece na garagem e no painel; o painel abre com "1 carro precisa de atenção" ou "todos em dia"; os botões mostram carregamento durante o envio; mensagens confirmam cada gravação. | — |
| 2. Correspondência com o mundo real | Termos de oficina (manutenção, revisão, laudo, quilometragem); datas no formato 25/09/2026 e valores em reais; a ficha da página inicial imita o caderno de manutenção. | — |
| 3. Controle e liberdade do usuário | Botões Voltar e Cancelar nos formulários; veículo pode ser inativado e reativado sem perder o histórico; tamanho do texto ajustável. | Exclusão de manutenção e de revisão não pode ser desfeita. |
| 4. Consistência e padrões | Mesma barra, mesmos botões e mesma ficha em todas as telas; cores com um único significado (marrom para ação, verde, âmbar e vermelho para estado). | — |
| 5. Prevenção de erros | Confirmação antes de excluir; catálogo preenche a ficha técnica; campos obrigatórios marcados com asterisco. | Máscaras de placa e telefone (#104). |
| 6. Reconhecer em vez de lembrar | Busca do modelo a partir de duas letras; menu com todas as áreas sempre visível; o item atual do menu fica destacado. | — |
| 7. Flexibilidade e eficiência | Atalhos no painel (Ver meus carros, Registrar revisão); navegação completa por teclado. | — |
| 8. Estética e design minimalista | Sem fotos de fundo, degradês, depoimentos ou números de marketing; cada tela mostra só o que serve à tarefa. | — |
| 9. Ajudar a reconhecer e corrigir erros | Mensagens de erro em português dizendo o que fazer ("As senhas não conferem", "Preencha a Quilometragem para continuar"). | Nos formulários internos, o erro aparece em aviso no canto da tela, e não ao lado do campo. |
| 10. Ajuda e documentação | Dicas abaixo dos campos (exemplo: "Pelo menos 6 caracteres"); conta de demonstração indicada na tela de acesso; tela Sobre prevista. | Tela Sobre (#103). |
