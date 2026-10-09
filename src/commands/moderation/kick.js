const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission, checkModerationHierarchy } = require('../../utils/permissions');
const { logKick } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Исключить участника с сервера')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('Пользователь для исключения')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Причина исключения')
        .setRequired(false)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    if (!hasModPermission(interaction.member)) {
      return interaction.reply({
        content: '❌ У вас нет прав для выполнения этой команды. Требуется роль модератора или права Администратора.',
        ephemeral: true
      });
    }

    const targetUser = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'Причина не указана';

    let targetMember = null;
    try {
      targetMember = await interaction.guild.members.fetch(targetUser.id);
    } catch {
      return interaction.reply({
        content: '❌ Пользователь не найден на этом сервере.',
        ephemeral: true
      });
    }

    const hierarchy = checkModerationHierarchy(interaction.member, targetMember);
    if (!hierarchy.allowed) {
      return interaction.reply({
        content: `❌ Невозможно исключить участника: ${hierarchy.reason}`,
        ephemeral: true
      });
    }

    // Уведомление в ЛС перед киком
    try {
      await targetMember.send({
        content: `⚠️ Вы были исключены с сервера **${interaction.guild.name}**.\n**Причина:** ${reason}\n**Модератор:** ${interaction.user.tag}`
      });
    } catch {
      // Игнорируем закрытый ЛС
    }

    try {
      await targetMember.kick(`${reason} | Модератор: ${interaction.user.tag}`);

      await logKick(interaction.guild, {
        moderator: interaction.user,
        target: targetUser,
        reason
      });

      return interaction.reply({
        content: `✅ Пользователь **${targetUser.tag}** успешно исключен с сервера.\n**Причина:** ${reason}`,
        ephemeral: false
      });
    } catch (err) {
      console.error('[Command: kick] Ошибка при кике:', err);
      return interaction.reply({
        content: `❌ Не удалось исключить пользователя: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
