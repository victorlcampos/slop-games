// Save que sobrevive à próxima versão do jogo.
//
// Duas ideias, cada uma vinda de um jogo daqui:
//
// 1. **Um formato só** (do Zoo Magnata): o mesmo retrato serve ao autosave e ao
//    arquivo exportado. Dois formatos viram dois saves divergindo, e o bug só
//    aparece no dia em que alguém importa.
// 2. **Normalizar em vez de confiar** (do Animais vs Monstros): todo save lido
//    passa por uma função que preenche o que falta e conserta o que está
//    errado. Save de versão antiga não pode quebrar o jogo — na pior hipótese
//    perde-se um campo novo, nunca a partida.
//
// O arquivo exportado carrega a marca do jogo, então importar o save errado dá
// erro claro em vez de estado corrompido.

const NADA = () => {};

/**
 * @param {object} cfg
 * @param {string} cfg.jogo       identificador curto, vai na chave e no arquivo
 * @param {number} cfg.versao     versão do formato
 * @param {function} cfg.inicial  devolve um save novo em folha
 * @param {function} [cfg.normalizar] (bruto, base) => save válido
 * @param {function} [cfg.aoAvisar]   (mensagem, tipo) para dar retorno na tela
 */
export function criarSave(cfg) {
  const {
    jogo,
    versao = 1,
    inicial,
    normalizar = (bruto, base) => ({ ...base, ...(bruto || {}) }),
    aoAvisar = NADA,
    chave = `${jogo}:save`,
  } = cfg;

  if (!jogo) throw new Error('criarSave: falta o nome do jogo');
  if (typeof inicial !== 'function') throw new Error('criarSave: `inicial` precisa ser função');

  /** Passa o bruto pela normalização e carimba versão/jogo. */
  function sanear(bruto) {
    const base = inicial();
    const s = normalizar(bruto, base) || base;
    s.versao = versao;
    return s;
  }

  const api = {
    chave,
    jogo,
    versao,

    novo() {
      return sanear(null);
    },

    carregar() {
      try {
        const bruto = localStorage.getItem(chave);
        if (!bruto) return api.novo();
        return sanear(JSON.parse(bruto));
      } catch {
        // storage bloqueado ou JSON quebrado: melhor começar do zero que travar
        return api.novo();
      }
    },

    salvar(estado, { silencioso = true } = {}) {
      try {
        estado.versao = versao;
        estado.atualizadoEm = new Date().toISOString();
        localStorage.setItem(chave, JSON.stringify(estado));
        if (!silencioso) aoAvisar('💾 Jogo salvo', 'bom');
        return true;
      } catch (err) {
        // modo privado ou cota estourada: o jogo continua, só não persiste
        if (!silencioso) aoAvisar('⚠️ Não deu para salvar: ' + err.message, 'ruim');
        return false;
      }
    },

    apagar() {
      try {
        localStorage.removeItem(chave);
        return true;
      } catch {
        return false;
      }
    },

    /** O mesmo retrato do autosave, agora como arquivo. */
    exportar(estado, { nome } = {}) {
      const dados = JSON.stringify({ ...estado, jogo, versao }, null, 2);
      const arquivo = nome || `${jogo}-${new Date().toISOString().slice(0, 10)}.json`;
      const ok = baixarTexto(arquivo, dados, 'application/json');
      aoAvisar(ok ? '📥 Save baixado' : '⚠️ Download falhou', ok ? 'bom' : 'ruim');
      return ok;
    },

    /**
     * Lê um arquivo escolhido pelo jogador. Recusa save de outro jogo — melhor
     * erro claro que estado corrompido.
     */
    async importar(input) {
      const texto = await lerArquivoTexto(input);
      let bruto;
      try {
        bruto = JSON.parse(texto);
      } catch {
        throw new Error('arquivo ilegível');
      }
      if (bruto.jogo && bruto.jogo !== jogo) {
        throw new Error(`esse save é do "${bruto.jogo}", não deste jogo`);
      }
      return sanear(bruto);
    },

    /** Aplica um retrato já lido (de arquivo ou de outro lugar). */
    aplicar(bruto) {
      return sanear(bruto);
    },
  };

  return api;
}

// ------------------------------------------------------------------ arquivo

/**
 * Baixa um texto como arquivo. O `revokeObjectURL` espera de propósito: no
 * Safari, revogar cedo demais cancela o download que ainda nem começou.
 */
export function baixarTexto(nome, conteudo, mime = 'application/json') {
  try {
    const blob = new Blob([conteudo], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch {
    return false;
  }
}

/**
 * Abre o seletor de arquivo e devolve o texto escolhido. Aceita um
 * `<input type=file>` existente ou cria um descartável.
 */
export function lerArquivoTexto(input) {
  return new Promise((resolve, reject) => {
    const el = input || Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' });

    const aoEscolher = () => {
      const arquivo = el.files && el.files[0];
      el.removeEventListener('change', aoEscolher);
      el.value = '';
      if (!arquivo) return reject(new Error('nada escolhido'));

      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result));
      leitor.onerror = () => reject(new Error('falha ao ler o arquivo'));
      leitor.readAsText(arquivo);
    };

    el.addEventListener('change', aoEscolher);
    el.click();
  });
}
