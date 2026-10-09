const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission, checkModerationHierarchy } = require('../../utils/permissions');
const { logWarn } = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Выдать официальное предупреждение участнику')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) =>
      option
        .setName('target')
        .setDescription('Пользователь для предупреждения')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reason')
        .setDescription('Причина предупреждения')
        .setRequired(true)
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
    const reason = interaction.options.getString('reason');

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
        content: `❌ Невозможно выдать предупреждение: ${hierarchy.reason}`,
        ephemeral: true
      });
    }

    let dmSent = false;
    try {
      await targetMember.send({
        content: `⚠️ Вам вынесено официальное предупреждение на сервере **${interaction.guild.name}**.\n**Причина:** ${reason}\n**Модератор:** ${interaction.user.tag}\n\n*Пожалуйста, ознакомьтесь с правилами сообщества, чтобы избежать блокировок.*`
      });
      dmSent = true;
    } catch {
      dmSent = false;
    }

    await logWarn(interaction.guild, {
      moderator: interaction.user,
      target: targetUser,
      reason
    });

    const dmNote = dmSent ? 'Уведомление доставлено в ЛС.' : '⚠️ Не удалось доставить ЛС (личные сообщения закрыты).';

    return interaction.reply({
      content: `⚠️ Пользователю **${targetUser.tag}** вынесено предупреждение.\n**Причина:** ${reason}\n${dmNote}`,
      ephemeral: false
    });
  }
};
