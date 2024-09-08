const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const { createObjectCsvWriter } = require('csv-writer');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const sqlite3 = require('better-sqlite3');
const { stringify } = require('querystring');


//Crindo pasta 'User'
const userDir = path.join(__dirname, 'user');
if (!fs.existsSync(userDir)){
    fs.mkdirSync(userDir);
}

let sessions = {};

// Carregar sessões de clientes do arquivo JSON
if (fs.existsSync('sessions.json')) {
  sessions = JSON.parse(fs.readFileSync('sessions.json'));
  console.log("Carregando sessões: " + stringify(sessions));
    
    // Inicializar clientes a partir das sessões carregadas que estão conectadas
    createClient('bot');
}
// Função para criar um cliente WhatsApp
function createClient(id, cmd) {
  log('38');
  const client = new Client({
      puppeteer: {
          args: ['--no-sandbox'],
          headless: true,
          executablePath: 'C://Program Files//Google//Chrome//Application//chrome.exe',
      },
      webVersionCache: {
        type: 'remote',
        remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.3000.html`,
    },
      authStrategy: new LocalAuth({ clientId: id })
  });
  client.on('qr', (qr) => {
    log('Gerando Code id: ' + id);
    cmd.reply('Fale com o Adm para Scanear o QRcode.');
    qrcode.generate(qr, { small: true });
  });
  try {
    client.on('ready', () => {
      log('55');
      console.log(`Cliente ${id} está pronto!`);
      //saveSessions();
      cmd.reply('Carregado com sucesso');
    });
  } catch (error) {
    console.log(error);
  }
  log('68');
  client.on('disconnected', () => {
    console.log(`Cliente ${id} desconectado`);
    //saveSessions();
    client.initialize(); // Re-inicializa o cliente
  });
  log('75');
  client.on('message_create', async message => {
  const idChat = message.from.replace("@c.us", ""); //qualquer macaco ta salvando com id
  const cmd = message.body;
  //console.log(stringify(sessions[idChat]));
  if (cmd === '.qr'){ //Quick Reaload e gera pastas
    if (id === 'bot' && !fs.existsSync(`./user/${idChat}`)) {
      fs.mkdir(`./user/${idChat}`, (err) => {
        if (err) { 
          return console.error(`Erro ao criar a pasta: ${err.message}`);
        }
        console.log('Pasta criada com sucesso!');
      });
    }
    if (cmd === '.qr' && !sessions[idChat]) {
      sessions[idChat] = {};
      log('Criando uma ID para: ' + idChat);
      createClient(idChat, message);
      //saveSessions();
    }
  }
  const botRecebe = (id === 'bot' && !message.fromMe && sessions[idChat]); //bot recebe cmd do cliente registrado
  const botEnvia = (id === 'bot' && message.fromMe);
  const idChatRecebe = (id !== 'bot' && !message.fromMe);
  const idChatEnvia = (id !== 'bot' && message.fromMe);
  const [command, inicio, fim] = message.body.split(' ');
  const [cmdDel, arg1, arg2] = message.body.split(' ');
  let envio = ['.envio', '.enviar'];
  let deletar = ['.del', '.deletar', '.apagar', '.delete'];
  if (id !== 'bot' && !message.fromMe)  { //recebedor nao for bot //filtro
    client.unarchiveChat(message.from, false);
  }  //verificando se qm enviou tem registro.
    //log('teste');
    if (botRecebe){ //recebedor for o BOT
      if (cmd.includes('.t ')){
        atualizarTexto(idChat ,cmd.replace('.t ', ''));
        log("Atualizando texto de: " + idChat);
        message.reply('Texto atualizado com sucesso!');
      }
      else if (cmd.includes('.ver')){
        VerConfig(idChat, client, message);
        //enviandoMensagem(idChat, client, message.from, null);
      }
      else if (cmd.includes('.retorno ')){
        let retorno = cmd.replace(".retorno ", "");
        let arqRetorno = path.join(`./user/${idChat}/`, `Retorno_Camp_${retorno}.xlsx`);
        fs.access(arqRetorno, fs.constants.F_OK, err => {
          if (err) {
            message.reply('Não tem dados dessa campanha!');
          } else {
            message.reply(MessageMedia.fromFilePath(`./user/${idChat}/Retorno_Camp_${retorno}.xlsx`));
          }});
      }
      else if (cmd.includes('.ajuda')){
        message.reply(`*COMANDOS DISPONIVEIS*\n\nDefina seu texto usando:\n*.t* (sua mensagem)\n@nome @nomecompleto @agencia\n\n_Lista, fotos e audio, apenas me envie._\nApagar use *.del (imagem/audio)*\n\nIniciar envio da lista.\n*.envio (inicio) (fim)*\n\nReceber retorno\n*.retorno* (campanha desejada)\n\n_.ver (veja como ficou sua mensagem)._`);
      }
      else if (cmd.includes('.buscar ')){
        infoBusca = message.body.replace('.buscar ', '');
        buscar(idChat, message, infoBusca);
      }
      else if (deletar.includes(cmdDel)) {
        if (arg1 === 'foto'){
          fs.access(`./user/${idChat}/imagem.jpeg`, fs.constants.F_OK, (err) => {
            if (err) {
              message.reply('Você não tem imagem salva!');
            } else {
              fs.unlink(`./user/${idChat}/imagem.jpeg`, err => {
                if (err) throw err;
                message.reply('Imagem de envio Apagada!');
              });
            }
          });
        }
        else if (arg1 === 'audio'){
          fs.access(`./user/${idChat}/audio.ogg`, fs.constants.F_OK, (err) => {
            if (err) {
              message.reply('Não tem audio para apagar!');
            } else {
              fs.unlink(`./user/${idChat}/audio.ogg`, err => {
                if (err) throw err;
                message.reply('Audio Apagado com Sucesso!');
              });
            }
          });
        }
        if (arg1 === "dados"){
          apagarContato(idChat, arg2);
          message.reply(`${arg2} deletado com sucesso!`);
        }
      }
      if (message.body === '..fim'){ // se 
        message.reply('Enviado com sucesso!');
      }
      if (message.hasMedia && !message.fromMe) {
        const userDir = `./user/${idChat}/`
        const media = await message.downloadMedia();
        if (media.mimetype === 'audio/ogg; codecs=opus') {
          // Salvar o arquivo de áudio em formato .ogg
          fs.writeFile(userDir+`audio.ogg`, media.data, 'base64', (err) => {
            if (err) {
              console.error('Erro ao salvar o arquivo de áudio:', err);
            } else {
              console.log(`Áudio Atualizado`);
              message.reply('Audio para envio atualizada.');
            }
          });
        }
      if (media.mimetype.startsWith('image/')) {
        const fileExtension = media.mimetype.split('/')[1]; // Obtém a extensão do arquivo, por exemplo, 'jpeg', 'png'
        // Salvar o arquivo de imagem
        fs.writeFile(userDir + `imagem.${fileExtension}`, media.data, 'base64', (err) => {
            if (err) {
                console.error('Erro ao salvar a imagem:', err);
            } else {
                //console.log(`Imagem Atualizada`);
                message.reply('Imagem salva para envio');
            }
        });
      }
      if (media.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        fs.writeFile(userDir+`lista.xlsx`, media.data, 'base64', (err) => {
          if (err) {
              //console.error('Erro ao salvar o arquivo:', err);
          } else {
            message.reply('Planilha Atualizada');
          }
        });
      }
      
      if (envio.includes(command)) { 
        try {
          workbook = XLSX.readFile(`./user/${idChat}/lista.xlsx`);
        }catch{
          message.reply('Nenhuma planilha encontrada.');
        }
        if (inicio <= 1){
          message.reply('Lista começa no 2.');
          return;
        }
      }
      log('193');
    }
  }
  //final botrecebe
  if (idChatEnvia && message.to === '554299633366@c.us'){ //Se tiver mandando para o bot .envio
    if (message.body === '.teste') {
      imprimirTodosContatos(idChat);
    }
    if (envio.includes(command)) { //cmd envio
      if (inicio <= 1){
        return;
      }
      let workbook;
      let dadosFiltrados;
      try {
        workbook = XLSX.readFile(`./user/${idChat}/lista.xlsx`);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        dadosFiltrados = jsonData.map((item) => ({
          NOME: String(item.Nome),
          CPF: parseInt(item.CPF),
          CONTA: parseInt(item.Nr_CC),
          CAMP: parseInt(item.Cod_Campanha),
          COBAN: parseInt(item.Cod_Coban),
          AGENCIA: parseInt(item.Prf_Depe),
          NASCIMENTO: item.Dt_Nascimento, 
          DDD_01: item.DDD_01,
          DDD_02: item.DDD_02,
          DDD_03: item.DDD_03,
          TEL_01: String(item.Tel_01),
          TEL_02: String(item.Tel_02),
          TEL_03: String(item.Tel_03),
        })); 
        await enviar(client ,idChat, inicio, fim, dadosFiltrados);
      }catch{
        console.log("Lista ou cabeçalho errado do id: " + idChat);
        return;
      }
    }
  }//idchat envia para robo
  if (idChatEnvia && message.to !== '554299633366@c.us'){ //idchat Envia para clientes
    if (cmd.includes('🪪')){ //buscar o cadastro do cliente pelo emoji
      puxarDados = message.to.replace('@c.us','');
      puxarDados = puxarDados.substring(2);
      client.sendMessage('554299633366@c.us', `.buscar ${puxarDados}`);
    }
    if (cmd.includes('📵')){
      let contato = message.to.replace('@c.us','');
      contato = contato.substring(2);
      //apagarContato(idChat, contato);
      await client.sendMessage('554299633366@c.us', `.delete dados ${contato}`);
    }
  }});// fecha message-create 
  log('270');
  client.initialize();
  log('275');
  //saveSessions();
} //fecha createCrlient
log('278g');
//scopo global
async function salvarContatoCSV(idChat, nome, numero) {
  // Verifica se o arquivo CSV já existe
  let records = [];
  if (fs.existsSync(`./user/${idChat}/contatos.csv`)) {
    const data = fs.readFileSync(`./user/${idChat}/contatos.csv`, 'utf-8');
    records = data.split('\n').slice(1).map(line => {
      const [nome, numero] = line.split(',');
      return { nome, numero };
    });
  }
  const csvWriter = createObjectCsvWriter({
    path: `./user/${idChat}/contatos.csv`,
    header: [
        { id: 'nome', title: 'Nome' },
        { id: 'numero', title: 'Número' }
      ]
    });
    records.push({ nome, numero });// Adiciona o novo contato
    await csvWriter.writeRecords(records);// Escreve os dados atualizados no arquivo CSV
  }

  function inserirContato(idChat, numero, nome, cpf, conta, agencia, campanha, dataNascimento, dataEnvioUltimaMensagem) {
    try {
      const db = sqlite3(`./user/${idChat}/dados.db`);
    db.exec(`
      CREATE TABLE IF NOT EXISTS contatos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero TEXT UNIQUE,
          nome TEXT,
          cpf TEXT,
          conta TEXT,
          agencia TEXT,
          campanha TEXT,
          data_nascimento TEXT,
          data_envio_ultima_mensagem TEXT
      )
  `);
    const stmt = db.prepare(`
        INSERT INTO contatos (numero, nome, cpf, conta, agencia, campanha, data_nascimento, data_envio_ultima_mensagem)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(numero) DO UPDATE SET
            nome = excluded.nome,
            cpf = excluded.cpf,
            conta = excluded.conta,
            agencia = excluded.agencia,
            campanha = excluded.campanha,
            data_nascimento = excluded.data_nascimento,
            data_envio_ultima_mensagem = excluded.data_envio_ultima_mensagem
    `);
    
    stmt.run(numero, nome, cpf, conta, agencia, campanha, dataNascimento, dataEnvioUltimaMensagem);
    db.close();
} catch (err) {
  console.error('Erro ao executar a operação no banco de dados:', err.message);
}}

async function enviar (client ,idChat , inicio, fim, dadosCliente){
  client.sendMessage('554299633366@c.us', 'Enviando...');
  for (let i = inicio - 2; i < fim - 1; i++) {
    let nomeCompleto;
    let nomeSeparado;
    let primeiroNome;
      
      let dados = dadosCliente[i];
      let campanha = dados.CAMP;
      let nomeArquivo = `./user/${idChat}/Retorno_Camp_${campanha}.xlsx`;
      if (!fs.existsSync(nomeArquivo)) {
        criarPlanilha(nomeArquivo);
      }
      //console.log("3");
      //remove quantos numeros adicionais tiver. caso tenha 12 caracteres ele atualiza e vai removendo até ficar 8
      if (dados.NOME !== undefined && dados.NOME !== null) {
        nomeCompleto = dados.NOME;
        nomeSeparado = nomeCompleto.split(' ');
        primeiroNome = nomeSeparado[0];
        for (let x = dados.TEL_01.length; dados.TEL_01.length > 8; x++){
          dados.TEL_01 = dados.TEL_01.substring(1);
        }
        for (let x = dados.TEL_02.length; dados.TEL_02.length > 8; x++){
          dados.TEL_02 = dados.TEL_02.substring(1);
        }
        for (let x = dados.TEL_03.length; dados.TEL_03.length > 8; x++){
          dados.TEL_03 = dados.TEL_03.substring(1);
        }
        let numeroOne = `55${dados.DDD_01+ dados.TEL_01}@c.us`;
        let numeroTwo = `55${dados.DDD_02+ dados.TEL_02}@c.us`;
        let numeroThree = `55${dados.DDD_03+ dados.TEL_03}@c.us`;
        let numeroAtual = '';
        let textoPersonalizado;
        try{
          textoPersonalizado = JSON.parse(fs.readFileSync(`./user/${idChat}/mensagem.json`, 'utf8'));
          textoPersonalizado = textoPersonalizado.replace("@nomecompleto", nomeCompleto);
          textoPersonalizado = textoPersonalizado.replace("@nome", primeiroNome);
          textoPersonalizado = textoPersonalizado.replace("@cpf", dados.CPF);
          textoPersonalizado = textoPersonalizado.replace("@agencia", dados.AGENCIA);
        }catch{
          log("Crie uma mensagem para enviar, use /texto (Mensagem)");
        }
        //console.log("4");
      console.log('enviando');
      await delay(15000);
      if (dados.DDD_01 === 0){
        numeroOne = `55999999@c.us`;
      }
      await client.isRegisteredUser(numeroOne).then(async (result) => {
      //console.log("5");
        numero = numeroOne.substring(2);
        numeroAtual = numero.replace('@c.us', '');
        if (result === true){
          await enviandoMensagem(idChat, client, numeroOne, textoPersonalizado);
          //console.log(`Sucesso ao contatar ${dados.NOME} no 1º Número : ${numeroAtual}`);
          adicionarDadosPlanilha(nomeArquivo, {Nome: dados.CPF, Numero: dados.CAMP, Status: '4', Data: new Date().toLocaleDateString()});
          salvarContatoCSV(idChat, `${dados.NOME} ${dados.CPF}`, "+55" + numeroAtual);
          inserirContato(idChat, numeroAtual, dados.NOME, dados.CPF, dados.CONTA, dados.AGENCIA, dados.CAMP, dados.NASCIMENTO, new Date().toLocaleDateString('pt-BR'));
          client.archiveChat(numeroOne, true);
        }else{
          //console.log(`Cliente ${dados.NOME} indisponivel no numero 1º : ${numeroAtual}`);
          if (dados.DDD_02 === 0){
            numeroTwo = `55999999@c.us`;
          }
          client.isRegisteredUser(numeroTwo).then((result) => {
          numero = numeroTwo.substring(2);
          numeroAtual = numero.replace('@c.us', '');
        if (result === true){
          enviandoMensagem(idChat, client, numeroTwo, textoPersonalizado);
          //console.log(`Sucesso ao contatar ${dados.NOME} no 2º Número : ${numeroAtual}`);
          adicionarDadosPlanilha(nomeArquivo, {Nome: dados.CPF, Numero: dados.CAMP, Status: '4', Data: new Date().toLocaleDateString()});
          salvarContatoCSV(idChat, `${dados.NOME} ${dados.CPF}`, "+55" + numeroAtual);
          inserirContato(idChat, numeroAtual, dados.NOME, dados.CPF, dados.CONTA, dados.AGENCIA, dados.CAMP, dados.NASCIMENTO, new Date().toLocaleDateString('pt-BR'));
          client.archiveChat(numeroTwo, true);
        }else{
          //console.log(`Cliente ${dados.NOME} indisponivel no numero 2º : ${numeroAtual}`);
          if (dados.DDD_03 === 0){
            numeroThree = `55999999@c.us`;
          }
          client.isRegisteredUser(numeroThree).then((result) => {
            numero = numeroThree.substring(2);
            numeroAtual = numero.replace('@c.us', '');
            if (result === true){
              enviandoMensagem(idChat, client, numeroThree, textoPersonalizado);
              //console.log(`Sucesso ao contatar ${dados.NOME} no 3º Número: ${numeroAtual}`);
              adicionarDadosPlanilha(nomeArquivo, {Nome: dados.CPF, Numero: dados.CAMP, Status: '4', Data: new Date().toLocaleDateString()});
              salvarContatoCSV(idChat, `${dados.NOME} ${dados.CPF}`, "+55" + numeroAtual);
              inserirContato(idChat, numeroAtual, dados.NOME, dados.CPF, dados.CONTA, dados.AGENCIA, dados.CAMP, dados.NASCIMENTO, new Date().toLocaleDateString('pt-BR'));
              client.archiveChat(numeroThree, true);  
            }else{
              adicionarDadosPlanilha(nomeArquivo, {Nome: dados.CPF, Numero: dados.CAMP, Status: '1', Data: new Date().toLocaleDateString()});
            }
          }
        )}
      })
      }}
    )}
  }
  return client.sendMessage('554299633366@c.us', '..fim');
}



function buscar(idChat, message, info) {
  try {
    let db = sqlite3(`./user/${idChat}/dados.db`);
    const stmt = db.prepare(`
      SELECT nome, cpf, conta, agencia, data_nascimento, campanha FROM contatos
      WHERE numero LIKE ? OR cpf LIKE ?
    `);
    const resultados = stmt.all(`%${info}%`, `%${info}%`);
    if (resultados.length > 0) {
      let resposta = "Cliente(s) Encontrado(s):\n";
      resultados.forEach(cliente => {
        resposta += `Nome: ${cliente.nome}\nCPF: ${parseInt(cliente.cpf)}\nConta: ${parseInt(cliente.conta)}\nAgência: ${parseInt(cliente.agencia)}\nCampanha: ${parseInt(cliente.campanha)}\n`;
      });
      return message.reply(resposta);
    } else {
      return message.reply("Nenhum dado encontrado para esse contato.");
    }
  } catch (error) {
    //console.log(error);
    return message.reply("Ocorreu um erro ao realizar a busca. Tente novamente.");
  }
}


function atualizarTexto(idChat ,texto){
  try {
    fs.writeFile(`./user/${idChat}/mensagem.json`, JSON.stringify(texto.replace('.t ', ''), null, 2), (err) => {
      if (err) {
        console.error('Erro ao salvar o arquivo JSON:', err);
      } else {
        console.log('Arquivo mensagem.json salvo com sucesso!');
      }
    });
  } catch (error) {
    console.log('Erro ao atualizar texto');
  }
}
function log(text){
  return console.log(text);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function criarPlanilha(nomeArquivo) {
  try {
    const cabecalho = ['CPF', 'Número da Campanha', 'Código Resultado', 'Data do Último Contato'];
    const dados = [cabecalho];
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(dados);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
    XLSX.writeFile(workbook, nomeArquivo);
  } catch (error) {
    log(error);
  }
}
function adicionarDadosPlanilha(nomeArquivo, dados) {
  try {    
    const workbook = XLSX.readFile(nomeArquivo);
    const worksheet = workbook.Sheets['Clientes'];
    const novaLinhaIndex = worksheet['!ref'].split(':')[1].replace(/\D/g,'');
    const novaLinha = novaLinhaIndex ? parseInt(novaLinhaIndex) + 0 : 1;
    // Adiciona os dados na planilha
    const keys = Object.keys(dados);
    keys.forEach((key, index) => {
      worksheet[XLSX.utils.encode_cell({ c: index, r: novaLinha })] = { t: 's', v: dados[key] };
    });
    // Atualiza o range da planilha
    worksheet['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: keys.length - 1, r: novaLinha } });
    // Salva o arquivo
    XLSX.writeFile(workbook, nomeArquivo);
  } catch (error) {
    log(error);
  }
}


function apagarContato(idChat, numero) {
  try {
    const db = sqlite3(`./user/${idChat}/dados.db`);
    const stmt = db.prepare(`
      DELETE FROM contatos
      WHERE numero = ?
    `);
    log('Deletado ' + numero +' do seu banco de dados');
    stmt.run(numero);
    db.close();
  } catch (err) {
    console.error('Erro ao executar a operação no banco de dados:', err.message);
  }
}
function imprimirTodosContatos(idChat) {
  try {
    const db = sqlite3(`./user/${idChat}/dados.db`);
    const rows = db.prepare(`SELECT * FROM contatos`).all();

    rows.forEach((row) => {
      console.log(row);
    });

    db.close();
  } catch (err) {
    console.error('Erro ao executar a operação no banco de dados:', err.message);
  }
}

function enviandoMensagem(idChat, client, destino, texto){
  try {
    client.sendMessage(destino ,texto);
  } catch (err) {
      return client.sendMessage(destino,'Você ainda não tem uma mensagem definida!');
  }
  fs.access(`./user/${idChat}/imagem.jpeg`, fs.constants.F_OK, (err) => {
    if (err) {
    } else {
        foto = MessageMedia.fromFilePath(`./user/${idChat}/imagem.jpeg`);
        client.sendMessage(destino, foto);
    }
  });
  fs.access(`./user/${idChat}/audio.ogg`, fs.constants.F_OK, (err) => {
    if (err) {
    } else {
        audio = MessageMedia.fromFilePath(`./user/${idChat}/audio.ogg`);
        client.sendMessage(destino, audio);
    }
  });
}


function VerConfig(idChat, client, message){
  const caminhoConfig = path.join(__dirname, 'user', idChat, 'mensagem.json');
  let respostaErro;
  try {
    const dados = fs.readFileSync(caminhoConfig, 'utf-8');
    message.reply(dados);
  } catch (err) {
      return message.reply('Você ainda não tem uma mensagem definida!');
  }
  fs.access(`./user/${idChat}/imagem.jpeg`, fs.constants.F_OK, (err) => {
    if (err) {
    } else {
        foto = MessageMedia.fromFilePath(`./user/${idChat}/imagem.jpeg`);
        client.sendMessage(message.from, foto);
    }
  });
  fs.access(`./user/${idChat}/audio.ogg`, fs.constants.F_OK, (err) => {
    if (err) {
    } else {
        audio = MessageMedia.fromFilePath(`./user/${idChat}/audio.ogg`);
        client.sendMessage(message.from, audio);
    }
  });
}
log('570');