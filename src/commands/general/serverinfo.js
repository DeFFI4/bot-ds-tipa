const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { COLORS } = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Показать подробную статистику и информацию о сервере'),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const { guild } = interaction;

    // Подгрузка участников для точной статистики ботов и людей
    await guild.members.fetch().catch(() => {});

    const totalMembers = guild.memberCount;
    const botCount = guild.members.cache.filter((m) => m.user.bot).size;
    const humanCount = totalMembers - botCount;

    const channels = guild.channels.cache;
    const textChannels = channels.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categories = channels.filter((c) => c.type === ChannelType.GuildCategory).size;

    const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(COLORS.PRIMARY)
      .setTitle(`🏰 Информация о сервере: ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '🆔 ID сервера', value: `\`${guild.id}\``, inline: true },
        { name: '👑 Владелец', value: `<@${guild.ownerId}>`, inline: true },
        { name: '📅 Дата создания', value: `<t:${createdTimestamp}:F>\n(<t:${createdTimestamp}:R>)`, inline: true },

        {
          name: '👥 Участники',
          value: `• Всего: **${totalMembers}**\n• Людей: **${humanCount}**\n• Ботов: **${botCount}**`,
          inline: true
        },
        {
          name: '💬 Каналы',
          value: `• Текстовых: **${textChannels}**\n• Голосовых: **${voiceChannels}**\n• Категорий: **${categories}**`,
          inline: true
        },
        {
          name: '🚀 Буст статус',
          value: `• Уровень: **${guild.premiumTier}**\n• Бустов: **${guild.premiumSubscriptionCount || 0}**`,
          inline: true
        },
        {
          name: '🎭 Роли',
          value: `Всего ролей: **${guild.roles.cache.size}**`,
          inline: true
        },
        {
          name: '🔒 Уровень верификации',
          value: `Уровень: **${guild.verificationLevel}**`,
          inline: true
        }
      );

    if (guild.description) {
      embed.setDescription(`*${guild.description}*`);
    }

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }));
    }

    embed.setFooter({ text: `Запросил: ${interaction.user.tag}` }).setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
