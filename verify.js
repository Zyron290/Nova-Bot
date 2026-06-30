const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    // Definimos el comando /verify
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Sistema de verificación Nova Guard'), // Mantiene tu descripción original

    async execute(interaction) {
        // 1. Creamos el Embed estético (Como el de Mokeno Security de la foto)
        const embed = new EmbedBuilder()
            .setTitle('🔒 Verificación de Seguridad')
            .setDescription('Para acceder al servidor, por favor haz clic en el botón de abajo para verificar que eres un humano.')
            .setColor('#2ecc71') // Verde éxito
            .setFooter({ text: 'Nova Guard Security' })
            .setTimestamp();

        // 2. Creamos el botón verde que conectará con el index.js
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('iniciar_verificacion') // <--- ID clave para activar el index.js
                .setLabel('Completar Verificación')
                .setStyle(ButtonStyle.Success) // Botón Verde
        );

        // 3. Respondemos al comando enviando el panel al canal
        // Usamos ephemeral: true para que la confirmación de "Panel enviado" solo la veas tú
        await interaction.reply({ content: '✅ ¡Panel de verificación enviado con éxito al canal!', ephemeral: true });
        
        // Enviamos el panel real de forma pública para que todos lo usen
        await interaction.channel.send({ embeds: [embed], components: [row] });
    }
};
