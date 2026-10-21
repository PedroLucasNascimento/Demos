# Campo Elétrico — Levantamento de campo

➡️ **[Abrir o demo](https://microsoftedge.github.io/Demos/temperature-converter/)** ⬅️

PWA offline-first para apoiar equipes técnicas no levantamento de campo de sistemas elétricos. O fluxo é dividido em duas etapas: capa do serviço (identificação, escopo, quantidade de SEs e observações) e gestão hierárquica de subestações e painéis.

Cada SE contém seus transformadores individuais, a possibilidade de alimentação do mesmo barramento (quando há mais de um transformador) e os demais equipamentos de média tensão; os painéis ficam associados à SE. Para cada transformador, o formulário registra o aterramento por resistor, a corrente do resistor e suas fotos. Os painéis incluem campos condicionais para unifilar, motores de média tensão, cabos e curto-circuito; neste último, as fotos de suportabilidade do painel e do disjuntor são obrigatórias, enquanto a opção de indisponibilidade oculta o preenchimento manual dos valores. Os estudos de seletividade/coordenação e energia incidente têm registros repetíveis para relés, disjuntores e compartimentos, conforme o escopo marcado na capa. SEs e painéis podem ser minimizados durante o preenchimento. Os levantamentos e imagens são gravados localmente como blobs no IndexedDB. Os registros criados na versão anterior são adaptados ao novo modelo ao serem carregados.

Bootstrap 5.3.3 e SheetJS são carregados pelo jsDelivr CDN e pré-armazenados pelo service worker quando há conexão. Abra o PWA online pelo menos uma vez para que os recursos sejam armazenados para uso offline. Para testar localmente, sirva esta pasta por HTTP; service workers exigem HTTPS ou `localhost`.

As fotos recebem marca d’água com data e hora, SE, equipamento e descrição antes de serem salvas. Na lista de levantamentos, escolha **Exportar Apenas Planilha (.xlsx)** para gerar um arquivo com as abas **Informações da SE**, **Estudo de Curto-Circuito**, **Informações dos TRAFOS**, **Estudo de Seletividade** e **Estudo de Energia Incidente**, ou **Exportar Levantamento Completo (.zip)** para incluir essa planilha e as fotos organizadas por obra, SE e painel. Os dados são locais ao navegador e dispositivo; não há sincronização com outros usuários.

## See also

* [Progressive Web Apps (PWAs) documentation](https://learn.microsoft.com/microsoft-edge/progressive-web-apps/landing/)
