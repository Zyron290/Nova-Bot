//comando de purge para eliminar mensajes en un canal de discord
const { SlashCommandBuilder } = require('discord.js');

module.exports = { 
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Elimina mensajes en el canal')
        .addIntegerOption(option =>
            option.setName('cantidad')
                .setDescription('Número de mensajes a eliminar')
                .setRequired(true)
        ),
    async execute(interaction) {
        const amount = interaction.options.getInteger('cantidad');

        if (amount < 1 || amount > 100) {
            return await interaction.reply({ content: 'Por favor, especifica un número entre 1 y 100.', ephemeral: true });
        }

        await interaction.channel.messages.fetch({ limit: amount }).then(messages => {
            interaction.channel.bulkDelete(messages);
        });

        await interaction.reply({ content: `Se han eliminado ${amount} mensajes.`, ephemeral: true });
    }
};
