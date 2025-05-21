const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function setupMyDiscordId(client) {
    client.on('ready', async () => {
        const myDiscordIdChannel = client.channels.cache.find(
            channel => channel.name === 'my-discord-id'
        );
        if (!channel) return;

        // Check if the button already exists
        const myDiscordIdChannelMessages = await myDiscordIdChannel.messages.fetch({ limit: 20 });
        const alreadyExists = myDiscordIdChannelMessages.some(msg =>
            msg.author.id === client.user.id &&
            msg.components.length > 0 &&
            msg.components[0].components.some(
                btn => btn.customId === 'show_my_discord_id'
            )
        );
        if (!alreadyExists) {
            await channel.send({
                content: 'Click the button below to see your Discord ID:',
                components: [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('show_my_discord_id')
                            .setLabel('My Discord ID')
                            .setStyle(ButtonStyle.Primary)
                    )
                ]
            });
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId !== 'show_my_discord_id') return;

        await interaction.reply({
            content: `Your Discord ID is: ${interaction.user.id}`,
            flags: 1 << 6 // Ephemeral
        });
    });
}

module.exports = { setupMyDiscordId };
