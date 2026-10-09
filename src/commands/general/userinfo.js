const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { COLORS, MOD_ROLE_ID } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Показать подробную информацию о пользователе')
    .addUserOption((opt) =>
      opt
        .setName('target')
        .setDescription('Пользователь (по умолчанию — вы)')
        .setRequired(false)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const user = interaction.options.getUser('target') || interaction.user;
    let member = null;

    try {
      member = await interaction.guild.members.fetch(user.id);
    } catch {
      member = null;
    }

    const createdTimestamp = Math.floor(user.createdTimestamp / 1000);
    const joinedTimestamp = member ? Math.floor(member.joinedTimestamp / 1000) : null;

    // Определение статуса/бейджа
    let roleStatus = '👤 Участник';
    if (interaction.guild.ownerId === user.id) {
      roleStatus = '👑 Владелец сервера';
    } else if (member && member.permissions.has('Administrator')) {
      roleStatus = '⚡ Администратор';
    } else if (member && member.roles.cache.has(MOD_ROLE_ID)) {
      roleStatus = '🛡️ Модератор Lounge';
    }

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`📋 Информация о пользователе: ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
        { name: '🏷️ Никнейм', value: member?.nickname ? `${member.nickname} (${user.username})` : user.username, inline: true },
        { name: '🔰 Статус', value: roleStatus, inline: true },
        {
          name: '📅 Регистрация в Discord',
          value: `<t:${createdTimestamp}:F>\n(<t:${createdTimestamp}:R>)`,
          inline: true
        }
      );

    if (member) {
      embed.addFields(
        {
          name: '📥 Присоединился к серверу',
          value: `<t:${joinedTimestamp}:F>\n(<t:${joinedTimestamp}:R>)`,
          inline: true
        },
        {
          name: '🎖️ Высшая роль',
          value: member.roles.highest ? `<@&${member.roles.highest.id}>` : 'Отсутствует',
          inline: true
        }
      );

      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild.id)
        .sort((a, b) => b.position - a.position)
        .map((r) => `<@&${r.id}>`);

      const rolesDisplay = roles.length > 0
        ? roles.length > 15
          ? `${roles.slice(0, 15).join(' ')} ... (всего ${roles.length})`
          : roles.join(' ')
        : 'Роли отсутствуют';

      embed.addFields({
        name: `🎭 Роли (${roles.length})`,
        value: rolesDisplay,
        inline: false
      });
    } else {
      embed.addFields({
        name: 'Сервер',
        value: 'Пользователь не состоит на текущем сервере.',
        inline: false
      });
    }

    embed.setFooter({ text: `Запросил: ${interaction.user.tag}` }).setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
