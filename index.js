const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers] });
client.verificationCodes = new Map();

client.commands = new Collection();

// Cargar comandos 
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
    }
console.log(`Cargados`, client.commands.map(cmd => cmd.name));
// bot listo
client.once('ready', () => {
    console.log(`bot encendido como ${client.user.tag}`);
    
 // deteccion + logs
    client.on('interactionCreate', async interaction => {
        console.log(`Interacción recibida`);
        if (!interaction.isChatInputCommand()) return;
        
        const command = client.commands.get(interaction.commandName);

        if (!command) {
            console.log(`Comando no encontrado`);
            return;
        }
        try {
            console.log(`Ejecutando comando ${interaction.commandName}`);
            await command.execute(interaction);
        } catch (error) {
            console.error(`Error`, error);

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error interno', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Error interno', ephemeral: true });
            }
        }
    });
});

// errores globales
process.on('unhandledRejection', error => {
    console.error('Unhandled', error);
});

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');

client.on('interactionCreate', async (interaction) => {
    // ==========================================
    // 🛑 CONTROL DE INTERACCIONES CON BOTONES
    // ==========================================
    if (interaction.isButton()) {
        // 1. Clic en el botón verde del servidor
        if (interaction.customId === 'iniciar_verificacion') {
            const code = Math.floor(10000 + Math.random() * 90000).toString();

            client.verificationCodes.set(interaction.user.id, {
                code: code,
                guildId: interaction.guild.id,
            });

            const dmEmbed = new EmbedBuilder()
                .setTitle('🔐 Proceso de Verificación')
                .setDescription(`Para verificar tu identidad en el servidor, ingresa el siguiente código numérico:\n\n**Código:** \`${code}\``)
                .setColor('#3498db')
                .addFields({ name: '⚠️ Atención', value: 'No compartas este código con nadie.' })
                .setTimestamp();

            const dmBoton = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('abrir_modal_dm')
                    .setLabel('Enviar Código')
                    .setStyle(ButtonStyle.Primary)
            );

            try {
                await interaction.user.send({ embeds: [dmEmbed], components: [dmBoton] });

                await interaction.reply({
                    content: '📥 Te hemos enviado el código de verificación y los pasos a tus Mensajes Directos (DMs).',
                    flags: MessageFlags.Ephemeral,
                });
            } catch (error) {
                await interaction.reply({
                    content: '❌ No pude enviarte el mensaje privado. Por favor, abre tus DMs de este servidor e inténtalo de nuevo.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        }

        // 2. Clic en el botón azul "Enviar Código" dentro del DM
        if (interaction.customId === 'abrir_modal_dm') {
            const modal = new ModalBuilder()
                .setCustomId('modal_verificacion')
                .setTitle('Ingresar Código de Verificación');

            const codeInput = new TextInputBuilder()
                .setCustomId('entrada_codigo')
                .setLabel('Ingresa los 5 dígitos')
                .setPlaceholder('12345')
                .setMinLength(5)
                .setMaxLength(5)
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(codeInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
        }
    }

    // ==========================================
    // 📝 CONTROL DE ENVÍO DE FORMULARIOS (MODALS)
    // ==========================================
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_verificacion') {
            const userCode = interaction.fields.getTextInputValue('entrada_codigo');
            const dataData = client.verificationCodes.get(interaction.user.id);

            if (!dataData) {
                return interaction.reply({
                    content: '❌ No tienes un código de verificación activo. Vuelve al servidor e inicia el proceso de nuevo.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (userCode === dataData.code) {
                try {
                    const guild = client.guilds.cache.get(dataData.guildId);

                    if (!guild) {
                        return interaction.reply({
                            content: '❌ No se pudo encontrar el servidor para completar la verificación.',
                            flags: MessageFlags.Ephemeral,
                        });
                    }

                    const member = await guild.members.fetch(interaction.user.id);
                    let role = guild.roles.cache.find(r => r.name === 'Verificado');

                    if (!role) {
                        role = await guild.roles.create({
                            name: 'Verificado',
                            color: '#2ecc71',
                            permissions: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                            reason: 'Creado automáticamente por Nova Guard con permisos seguros.',
                        });
                        console.log(`[Nova Guard] Se creó el rol "Verificado" con permisos básicos en: ${guild.name}`);
                    }

                    await member.roles.add(role.id);
                    console.log(`[Nova Guard] ✅ ¡Rol asignado con éxito a ${member.user.username} en ${guild.name}!`);

                    client.verificationCodes.delete(interaction.user.id);

                    await interaction.reply({
                        content: `🎉 ¡Verificación completada con éxito, ${member}! El rol **${role.name}** ha sido añadido a tu perfil.`,
                        flags: MessageFlags.Ephemeral,
                    });
                } catch (error) {
                    console.error('Error al otorgar el rol:', error);
                    await interaction.reply({
                        content: '⚠️ Código correcto, pero ocurrió un error interno al intentar asignarte el rol. Revisa la jerarquía.',
                        flags: MessageFlags.Ephemeral,
                    });
                }
            }
        }
    }
});

const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

client.on('guildMemberAdd', async (member) => {
    // ID del canal donde quieres que aparezcan las bienvenidas (Cámbialo por el tuyo)
    const channelId = '1521556655102234796'; 
    const channel = member.guild.channels.cache.get(channelId);
    
    if (!channel) return; // Si no encuentra el canal, no hace nada

    try {
        // ==========================================
        // 🎨 DISEÑO DE LA TARJETA GRÁFICA (CANVAS)
        // ==========================================
        const canvas = createCanvas(700, 250);
        const ctx = canvas.getContext('2d');

        // 1. Fondo de la tarjeta (Estilo Nova Guard: Negro tecnológico)
        ctx.fillStyle = '#0f1115';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Ajustamos bordes estéticos o detalles de fondo
        ctx.strokeStyle = '#722ecc'; 
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        // 2. Dibujar el texto de Bienvenida
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px sans-serif';
        ctx.fillText('¡BIENVENIDO/A!', 250, 100);

        // 3. Dibujar el nombre del usuario
        ctx.fillStyle = '#722ecc'; // Morado Nova Guard
        ctx.font = 'bold 28px sans-serif';
        // Cortamos el nombre si es excesivamente largo para que no se salga de la imagen
        const username = member.user.username.length > 15 ? member.user.username.substring(0, 15) + '...' : member.user.username;
        ctx.fillText(username, 250, 145);

        // 4. Dibujar el contador de miembros
        ctx.fillStyle = '#a3a6aa'; // Gris claro
        ctx.font = '18px sans-serif';
        ctx.fillText(`Miembro #${member.guild.memberCount}`, 250, 185);

        // 5. Cargar y dibujar el Avatar del usuario en círculo
        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatarImage = await loadImage(avatarURL);

        ctx.save();
        ctx.beginPath();
        ctx.arc(130, 125, 65, 0, Math.PI * 2, true); // Círculo para el avatar
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImage, 65, 60, 130, 130);
        ctx.restore();

        // Convertimos todo el dibujo en un archivo adjunto de Discord
        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'bienvenida-novaguard.png' });

        // ==========================================
        // ✉️ DISEÑO DEL MENSAJE (EMBED)
        // ==========================================
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#722ecc') // Morado Nova Guard
            .setTitle(`👋 ¡Bienvenido/a a ${member.guild.name}!`)
            .setDescription(`Hola ${member}, desde la administración de Nova Systems esperamos que disfrutes tu experiencia en el servidor. Recuerda completar tu verificación en el canal correspondiente y seguir la normativa vigente. 🔒`)
            .setImage('attachment://bienvenida-novaguard.png') // Vincula la imagen del canvas aquí
            .setTimestamp()
            .setFooter({ text: 'Nova Guard | Security System', iconURL: client.user.displayAvatarURL() });

        // Enviamos el mensaje al canal con la imagen incrustada
        await channel.send({ embeds: [welcomeEmbed], files: [attachment] });

    } catch (error) {
        console.error('Error al generar la tarjeta de bienvenida:', error);
    }
});

// ==========================================
// 🛡️ MENSAJE DE BIENVENIDA AL CONECTAR A UN SERVIDOR
// ==========================================
client.on('guildCreate', async (guild) => {
    // Buscamos el canal de sistema (donde Discord avisa cuando entra alguien o se une un bot)
    // Si no está activo, busca el primer canal de texto donde el bot tenga permiso para escribir
    const channel = guild.systemChannel || guild.channels.cache.find(ch => 
        ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages')
    );

    // Si el servidor es completamente privado y no encontramos ningún canal disponible, no hace nada
    if (!channel) return;

    try {
        const joinEmbed = new EmbedBuilder()
            .setTitle('🛡️ ¡Nova Guard ha sido Activado!')
            .setDescription(`Muchas gracias por invitarme a **${guild.name}**. Estoy listo para asegurar y automatizar la gestión de tu comunidad.`)
            .setColor('#722ecc') // Morado Nova Guard
            .addFields(
                { 
                    name: '🚀 Configuración Inicial', 
                    value: 'Para instalar el panel visual con el botón de seguridad, ve al canal deseado y ejecuta el comando `/verify`.' 
                },
                { 
                    name: '⚠️ Recordatorio de Permisos', 
                    value: 'Para que pueda asignar el rol de verificado automáticamente, entra a la **Configuración del Servidor -> Roles** y arrastra mi rol **por encima** del rol que voy a entregar.' 
                },
                { 
                    name: '📊 Funciones Listas', 
                    value: '• **Verificación Inteligente:** Código seguro de 5 dígitos enviado por DM.\n• **Bienvenidas Premium:** Tarjetas gráficas personalizadas en tiempo real con el avatar del usuario.' 
                }
            )
            .setFooter({ text: 'Nova Guard Security System', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        // Enviamos el mensaje de presentación al canal encontrado
        await channel.send({ embeds: [joinEmbed] });

    } catch (error) {
        console.error(`Error al enviar mensaje de presentación en el servidor ${guild.name}:`, error);
    }
});

// ==========================================
// 🚫 FILTRO ANTI-ENLACES (SEGURIDAD EN CHAT)
// ==========================================
client.on('messageCreate', async (message) => {
    // 1. Si el mensaje lo envió un bot, no hacemos nada
    if (message.author.bot) return;

    // 2. ✨ NUEVO: Si el usuario es Administrador, lo ignoramos (tiene inmunidad)
    if (message.member && message.member.permissions.has('Administrator')) return;

    // Lista de lo que queremos bloquear
    const patronesProhibidos = ['http://', 'https://', 'discord.gg/', '.com', '.net'];
    const tieneEnlace = patronesProhibidos.some(patron => message.content.toLowerCase().includes(patron));

    if (tieneEnlace) {
        try {
            await message.delete();

            const aviso = await message.channel.send(`⚠️ **Nova Guard:** ¡${message.author}, no tienes permitido enviar enlaces en este servidor!`);
            setTimeout(() => aviso.delete().catch(() => {}), 5000);

        } catch (error) {
            console.error('Error en el filtro anti-enlaces:', error);
        }
    }
});

// token 
client.login(process.env.TOKEN);
