const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { hasModPermission } = require('../../utils/permissions');
const { getOrCreateLogChannel, logSystem } = require('../../utils/logger');
const { LOG_CHANNEL_NAME, COLORS } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-logs')
    .setDescription('Инициализировать или проверить канал аудита lounge-logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

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

    await interaction.deferReply({ ephemeral: true });

    try {
      const channel = await getOrCreateLogChannel(interaction.guild);

      if (!channel) {
        return interaction.editReply({
          content: '❌ Не удалось найти или создать канал логов. Проверьте права бота (Manage Channels).'
        });
      }

      await logSystem(interaction.guild, {
        title: '🔧 Проверка канала аудита',
        description: `Команда \`/setup-logs\` вызвана модератором <@${interaction.user.id}>. Канал аудита функционирует корректно.`,
        color: COLORS.SUCCESS,
        fields: [
          { name: 'Канал', value: `<#${channel.id}>`, inline: true }
        ]
      });

      return interaction.editReply({
        content: `✅ Канал аудита **#${LOG_CHANNEL_NAME}** готов к работе: <#${channel.id}>. Доступ ограничен администраторами и модераторами.`
      });
    } catch (err) {
      console.error('[Command: setup-logs] Ошибка:', err);
      return interaction.editReply({
        content: `❌ Произошла ошибка: ${err.message}`
      });
    }
  }
};
