// Archivo para registrar comandos slash en Discord
// Ejecuta este archivo cuando quieras forzar que los comandos aparezcan en tu servidor.
require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('ERROR: Asegúrate de tener DISCORD_TOKEN y CLIENT_ID en .env');
  process.exit(1);
}

// Validar que el GUILD_ID tenga el formato de snowflake de Discord
if (!guildId || !/^[0-9]{17,19}$/.test(guildId)) {
  console.error('ERROR: GUILD_ID inválido. Debe ser un ID de servidor de Discord con 17-19 dígitos.');
  process.exit(1);
}

// Define aquí los comandos que quieres forzar en Discord
const commands = [
new SlashCommandBuilder()
    .setName('ping')
    .setDescription('muestra la latencia del bot'),
    new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Elimina mensajes en el canal')
    .addIntegerOption(option =>
        option.setName('cantidad')
            .setDescription('Número de mensajes a eliminar')
            .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Envía un panel de verificación con un botón')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`Registrando ${commands.length} comandos en el servidor ${guildId}...`);

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('Comandos registrados correctamente.');
  } catch (error) {
    console.error('Error al registrar comandos:', error);
  }
})();
