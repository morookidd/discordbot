const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { Client, GatewayIntentBits } = require('discord.js');
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { setupMyDiscordId } = require('./commands/mydiscordid');

const dotenv = require('dotenv');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

dotenv.config();

const token = process.env.DISCORD_TOKEN;

// In-memory storage for team data per user
const userTeams = {};

setupMyDiscordId(client);

client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // If the message is in the #my-discord-id channel, reply with the user's Discord ID
    if (message.channel.name === 'my-discord-id') {
        await message.reply(`Your Discord ID is: ${message.author.id}`);
        return;
    }

    // Previous "hi" command code...
});

// New code for registration system
client.on('ready', async () => {
    // Find the registration channel
    const registerChannel = client.channels.cache.find(
        channel => channel.name === 'register'
    );

    if (!registerChannel) {
        console.log('Register channel not found!');
        return;
    }

    // Check if the "Create Team" button message already exists
    const messages = await registerChannel.messages.fetch({ limit: 20 });
    const alreadyExists = messages.some(msg =>
        msg.author.id === client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components.some(
            btn => btn.customId === 'create_team'
        )
    );

    if (!alreadyExists) {
        // Send the registration message (only do this once!)
        registerChannel.send({
            content: 'Click the button below to register a new team:',
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_team')
                        .setLabel('Create Team')
                        .setStyle(ButtonStyle.Primary)
                )
            ]
        });
    }
});

client.once('ready', async () => {
    // Register the /myid command
    const commands = [
        new SlashCommandBuilder()
            .setName('myid')
            .setDescription('Display your Discord user ID')
            .toJSON()
    ];
    const rest = new REST({ version: '10' }).setToken(token);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Registered /myid command.');
    } catch (error) {
        console.error(error);
    }
});

// Handle button clicks
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const hasTeam = !!userTeams[interaction.user.id];
    const isEdit = interaction.customId === 'edit_team';

    // Add Players button logic
    if (interaction.customId === 'add_players') {
        const team = userTeams[interaction.user.id];
        if (!team) {
            await interaction.reply({ content: 'You need to create a team first!', flags: 1 << 6 });
            return;
        }
        const playerCount = (team.players && team.players.length) || 0;
        if (playerCount >= 6) {
            await interaction.reply({ content: 'You already have 6 players in your team.', flags: 1 << 6 });
            return;
        }

        // Show modal to add a player
        const modal = new ModalBuilder()
            .setCustomId('addPlayerModal')
            .setTitle(`Add Player ${playerCount + 1}`);

        const pubgNameInput = new TextInputBuilder()
            .setCustomId('pubgName')
            .setLabel('PUBG Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const pubgUidInput = new TextInputBuilder()
            .setCustomId('pubgUid')
            .setLabel('PUBG UID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const discordIdInput = new TextInputBuilder()
            .setCustomId('playerDiscordId')
            .setLabel('Discord ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(pubgNameInput),
            new ActionRowBuilder().addComponents(pubgUidInput),
            new ActionRowBuilder().addComponents(discordIdInput)
        );

        await interaction.showModal(modal);
        return;
    }

    // Edit Player button logic
    if (interaction.customId.startsWith('edit_player_')) {
        const playerIndex = parseInt(interaction.customId.split('_')[2], 10);
        const team = userTeams[interaction.user.id];
        if (!team || !team.players || !team.players[playerIndex]) {
            await interaction.reply({ content: 'Player not found.', flags: 1 << 6 });
            return;
        }
        const player = team.players[playerIndex];

        // Show modal to edit player
        const modal = new ModalBuilder()
            .setCustomId(`editPlayerModal_${playerIndex}`)
            .setTitle(`Edit Player ${playerIndex + 1}`);

        const pubgNameInput = new TextInputBuilder()
            .setCustomId('pubgName')
            .setLabel('PUBG Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(player.pubgName);

        const pubgUidInput = new TextInputBuilder()
            .setCustomId('pubgUid')
            .setLabel('PUBG UID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(player.pubgUid);

        const discordIdInput = new TextInputBuilder()
            .setCustomId('playerDiscordId')
            .setLabel('Discord ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(player.playerDiscordId);

        modal.addComponents(
            new ActionRowBuilder().addComponents(pubgNameInput),
            new ActionRowBuilder().addComponents(pubgUidInput),
            new ActionRowBuilder().addComponents(discordIdInput)
        );

        await interaction.showModal(modal);
        return;
    }

    // Remove Player button logic
    if (interaction.customId.startsWith('remove_player_')) {
        const playerIndex = parseInt(interaction.customId.split('_')[2], 10);
        const team = userTeams[interaction.user.id];
        if (!team || !team.players || !team.players[playerIndex]) {
            await interaction.reply({ content: 'Player not found.', flags: 1 << 6 });
            return;
        }
        team.players.splice(playerIndex, 1);

        // Update or send the player list message and status message
        await updatePlayerListMessage(interaction, team, 'Player removed.');
        await sendEditAndAddButtons(interaction, team);
        return;
    }

    if (interaction.customId === 'create_team' || isEdit) {
        // Use stored data if editing, otherwise empty/defaults
        const prevData = userTeams[interaction.user.id] || {};
        const modal = new ModalBuilder()
            .setCustomId('teamRegistration')
            .setTitle(isEdit ? 'Edit Team' : 'Team Registration');

        const teamNameInput = new TextInputBuilder()
            .setCustomId('teamName')
            .setLabel('Team Name')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(prevData.teamName || '');

        const teamTagInput = new TextInputBuilder()
            .setCustomId('teamTag')
            .setLabel('Team Tag')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(prevData.teamTag || '');

        const contactEmailInput = new TextInputBuilder()
            .setCustomId('contactEmail')
            .setLabel('Contact Email')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(prevData.contactEmail || '');

        const discordIdInput = new TextInputBuilder()
            .setCustomId('discordId')
            .setLabel('Your Discord ID')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue(interaction.user.id);

        // Add inputs to action rows
        const firstActionRow = new ActionRowBuilder().addComponents(teamNameInput);
        const secondActionRow = new ActionRowBuilder().addComponents(teamTagInput);
        const thirdActionRow = new ActionRowBuilder().addComponents(contactEmailInput);
        const fourthActionRow = new ActionRowBuilder().addComponents(discordIdInput);

        // Add action rows to modal
        modal.addComponents(firstActionRow, secondActionRow, thirdActionRow, fourthActionRow);

        // Show the modal to the user
        await interaction.showModal(modal);
    }
});

// Helper to send the edit/add buttons ephemerally to the user
async function sendEditAndAddButtons(interaction, team) {
    await interaction.followUp({
        content: 'Use the buttons below to edit your team or add players:',
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_team')
                    .setLabel('Edit Team')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('add_players')
                    .setLabel('Add Players')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(team.players.length >= 6)
            )
        ],
        flags: 1 << 6 // Ephemeral
    });
}

// Handle modal submissions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'teamRegistration') {
        // Get the submitted data
        const teamName = interaction.fields.getTextInputValue('teamName');
        const teamTag = interaction.fields.getTextInputValue('teamTag');
        const contactEmail = interaction.fields.getTextInputValue('contactEmail');
        const discordId = interaction.fields.getTextInputValue('discordId');

        // Save the team data for the user
        userTeams[interaction.user.id] = { teamName, teamTag, contactEmail, discordId, players: userTeams[interaction.user.id]?.players || [] };

        // Update or send the player list message and status message
        await updatePlayerListMessage(interaction, userTeams[interaction.user.id], 'Team updated!');
        // Send the edit/add buttons ephemerally
        await sendEditAndAddButtons(interaction, userTeams[interaction.user.id]);
        return;
    }

    if (interaction.customId === 'addPlayerModal') {
        // Get player data from modal
        const pubgName = interaction.fields.getTextInputValue('pubgName');
        const pubgUid = interaction.fields.getTextInputValue('pubgUid');
        const playerDiscordId = interaction.fields.getTextInputValue('playerDiscordId');

        // Store player in user's team
        if (!userTeams[interaction.user.id].players) userTeams[interaction.user.id].players = [];
        userTeams[interaction.user.id].players.push({ pubgName, pubgUid, playerDiscordId });

        // Update or send the player list message and status message
        const team = userTeams[interaction.user.id];
        await updatePlayerListMessage(interaction, team, 'Player added!');
        // Send the edit/add buttons ephemerally
        await sendEditAndAddButtons(interaction, team);
        return;
    }

    // Handle edit player modal
    if (interaction.customId.startsWith('editPlayerModal_')) {
        const playerIndex = parseInt(interaction.customId.split('_')[1], 10);
        const team = userTeams[interaction.user.id];
        if (!team || !team.players || !team.players[playerIndex]) {
            await interaction.reply({ content: 'Player not found.', flags: 1 << 6 });
            return;
        }
        // Update player data
        team.players[playerIndex] = {
            pubgName: interaction.fields.getTextInputValue('pubgName'),
            pubgUid: interaction.fields.getTextInputValue('pubgUid'),
            playerDiscordId: interaction.fields.getTextInputValue('playerDiscordId')
        };

        // Update or send the player list message and status message
        await updatePlayerListMessage(interaction, team, 'Player updated!');
        // Send the edit/add buttons ephemerally
        await sendEditAndAddButtons(interaction, team);
        return;
    }
});

// --- Helper function to update or send the player list message ---
async function updatePlayerListMessage(interaction, team, statusText = '') {
    const userId = interaction.user.id;

    let playerList = '';
    const components = [];
    let sixthPlayer = null;
    let sixthComponents = [];

    if (team.players.length > 0) {
        team.players.forEach((player, idx) => {
            if (idx < 5) {
                playerList += `**Player ${idx + 1}:** PUBG Name: ${player.pubgName}, PUBG UID: ${player.pubgUid}, Discord ID: ${player.playerDiscordId}\n`;
                components.push(
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`edit_player_${idx}`)
                            .setLabel(`Edit Player ${idx + 1}`)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`remove_player_${idx}`)
                            .setLabel(`Remove Player ${idx + 1}`)
                            .setStyle(ButtonStyle.Danger)
                    )
                );
            } else if (idx === 5) {
                sixthPlayer = player;
                sixthComponents = [
                    new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId(`edit_player_${idx}`)
                            .setLabel(`Edit Player ${idx + 1}`)
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`remove_player_${idx}`)
                            .setLabel(`Remove Player ${idx + 1}`)
                            .setStyle(ButtonStyle.Danger)
                    )
                ];
            }
        });
    } else {
        playerList = 'No players added yet.';
    }

    const teamHeader = team.teamName && team.teamTag
        ? `**${team.teamName} (${team.teamTag})**\n`
        : '';

    let content = `${teamHeader}**Your Team Players:**\n${playerList}\nTotal players: ${team.players.length}/6`;
    if (statusText) {
        content = `${statusText}\n\n${content}`;
    }

    // First message: up to 5 players
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
            content,
            components,
            flags: 1 << 6 // Ephemeral
        });
    } else {
        await interaction.reply({
            content,
            components,
            flags: 1 << 6 // Ephemeral
        });
    }

    // Second message: 6th player (if exists)
    if (sixthPlayer) {
        const sixthContent = `**Player 6:** PUBG Name: ${sixthPlayer.pubgName}, PUBG UID: ${sixthPlayer.pubgUid}, Discord ID: ${sixthPlayer.playerDiscordId}`;
        // Try to find a previous followUp from this interaction for the 6th player
        // (We can't edit a previous followUp easily, so just send a new ephemeral followUp each time)
        await interaction.followUp({
            content: sixthContent,
            components: sixthComponents,
            flags: 1 << 6 // Ephemeral
        });
    }
}

// Handle /myid command
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand() && interaction.commandName === 'myid') {
        await interaction.reply({
            content: `Your Discord ID is: ${interaction.user.id}`,
            flags: 1 << 6 // Ephemeral
        });
        return;
    }
});

client.login(token);