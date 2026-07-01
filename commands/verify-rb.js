const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ======================================================
// Almacenamiento temporal de verificaciones pendientes
// ⚠️ Esto vive en memoria: si el bot se reinicia, se pierde.
// Para producción real, reemplaza este Map por una base de
// datos (ej. SQLite, MongoDB, Postgres) para persistencia.
// ======================================================
const verificacionesPendientes = new Map(); // key: discordId, value: { robloxUserId, robloxUsername, codigo }

function generarCodigo() {
    // Genera un código corto tipo "ROVER-XXXXXX"
    return `VERIFY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verificar')
        .setDescription('Vincula tu cuenta de Roblox a Discord de forma verificada.')
        .addStringOption(option =>
            option.setName('usuario')
                .setDescription('Tu nombre de usuario de Roblox (username, no display name)')
                .setRequired(true)
        ),

    execute: async function(interaction) {
        const usernameRoblox = interaction.options.getString('usuario');

        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. Buscamos el userId a partir del username
            const resBusqueda = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usernames: [usernameRoblox],
                    excludeBannedUsers: true
                })
            });

            const dataBusqueda = await resBusqueda.json();

            if (!dataBusqueda.data || dataBusqueda.data.length === 0) {
                return interaction.editReply({
                    content: `❌ No se encontró ningún usuario de Roblox con el nombre **${usernameRoblox}**. Verifica que esté bien escrito.`
                });
            }

            const usuarioEncontrado = dataBusqueda.data[0];
            const robloxUserId = usuarioEncontrado.id;
            const robloxUsername = usuarioEncontrado.name;

            // 2. Generamos un código único para esta verificación
            const codigo = generarCodigo();

            verificacionesPendientes.set(interaction.user.id, {
                robloxUserId,
                robloxUsername,
                codigo
            });

            // 3. Embed con instrucciones
            const embedInstrucciones = new EmbedBuilder()
                .setTitle('🔐 Verificación de Cuenta Roblox')
                .setDescription(
                    `Para confirmar que **${robloxUsername}** es tu cuenta, sigue estos pasos:\n\n` +
                    `**1.** Copia este código:\n\`\`\`${codigo}\`\`\`\n` +
                    `**2.** Pégalo en la descripción ("About") de tu perfil de Roblox.\n` +
                    `**3.** Vuelve aquí y presiona el botón **"Ya lo puse ✅"**.\n\n` +
                    `Puedes quitar el código de tu perfil una vez verificado.`
                )
                .setColor('#f1c40f')
                .setTimestamp();

            const botonConfirmar = new ButtonBuilder()
                .setCustomId(`confirmar_verificacion_${interaction.user.id}`)
                .setLabel('Ya lo puse ✅')
                .setStyle(ButtonStyle.Success);

            const fila = new ActionRowBuilder().addComponents(botonConfirmar);

            const mensaje = await interaction.editReply({
                embeds: [embedInstrucciones],
                components: [fila]
            });

            // 4. Colector para el botón de confirmación (10 minutos para completar)
            const colector = mensaje.createMessageComponentCollector({ time: 600000 });

            colector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({
                        content: '⚠️ Este botón no es para ti.',
                        ephemeral: true
                    });
                }

                await i.deferUpdate();

                const pendiente = verificacionesPendientes.get(interaction.user.id);

                if (!pendiente) {
                    return i.followUp({
                        content: '❌ Esta verificación ya expiró o no es válida. Usa `/verificar` de nuevo.',
                        ephemeral: true
                    });
                }

                // 5. Consultamos la descripción actual del perfil de Roblox
                const resPerfil = await fetch(`https://users.roblox.com/v1/users/${pendiente.robloxUserId}`);
                const dataPerfil = await resPerfil.json();
                const descripcion = dataPerfil.description || '';

                if (!descripcion.includes(pendiente.codigo)) {
                    return i.followUp({
                        content: `❌ No encontré el código **${pendiente.codigo}** en tu descripción de perfil. Asegúrate de guardarlo correctamente en Roblox y vuelve a intentar.`,
                        ephemeral: true
                    });
                }

                // 6. Verificación exitosa: aplicamos el apodo
                const robloxDisplayName = dataPerfil.displayName;
                const nuevoApodo = `${robloxDisplayName} (${pendiente.robloxUsername})`;

                try {
                    await interaction.member.setNickname(nuevoApodo);
                } catch (err) {
                    console.error('No se pudo cambiar el apodo:', err);
                    // Continúa igual, solo avisa del problema de permisos
                }

                verificacionesPendientes.delete(interaction.user.id);
                colector.stop('verificado');

                const embedExito = new EmbedBuilder()
                    .setTitle('✅ ¡Verificación Completada!')
                    .setDescription(`Tu cuenta de Roblox **${pendiente.robloxUsername}** ha sido vinculada correctamente.`)
                    .addFields(
                        { name: 'Usuario (Username)', value: pendiente.robloxUsername, inline: true },
                        { name: 'Apodo (Display Name)', value: robloxDisplayName, inline: true },
                        { name: 'Nuevo apodo en Discord', value: nuevoApodo, inline: false }
                    )
                    .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${pendiente.robloxUserId}&width=150&height=150&format=png`)
                    .setColor('#2ecc71')
                    .setTimestamp();

                await interaction.editReply({
                    embeds: [embedExito],
                    components: []
                });
            });

            colector.on('end', (collected, reason) => {
                if (reason !== 'verificado') {
                    verificacionesPendientes.delete(interaction.user.id);
                }
            });

        } catch (error) {
            console.error('Error al iniciar verificación de Roblox:', error);
            await interaction.editReply({
                content: '❌ Ocurrió un error al conectar con la API de Roblox. Intenta de nuevo en unos momentos.'
            });
        }
    }
};
