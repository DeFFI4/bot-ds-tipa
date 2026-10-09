const { Events, AuditLogEvent } = require('discord.js');
const { logMemberJoin, logMemberLeave } = require('../utils/logger');

module.exports = [
  {
    name: Events.GuildMemberAdd,
    /**
     * @param {import('discord.js').GuildMember} member
     */
    async execute(member) {
      if (!member.guild) return;
      try {
        await logMemberJoin(member.guild, member);
      } catch (err) {
        console.error('[Events: GuildMemberAdd] Ошибка при логировании входа:', err);
      }
    }
  },
  {
    name: Events.GuildMemberRemove,
    /**
     * @param {import('discord.js').GuildMember} member
     */
    async execute(member) {
      if (!member.guild) return;

      let kickData = null;
      try {
        // Проверяем Audit Log на предмет недавнего кика
        const fetchedLogs = await member.guild.fetchAuditLogs({
          limit: 1,
          type: AuditLogEvent.MemberKick
        });

        const kickLog = fetchedLogs.entries.first();
        if (kickLog && kickLog.target?.id === member.id) {
          // Если событие кика произошло не более 5 секунд назад
          const diffMs = Date.now() - kickLog.createdTimestamp;
          if (diffMs < 5000) {
            kickData = {
              executor: kickLog.executor,
              reason: kickLog.reason
            };
          }
        }
      } catch (err) {
        // Если у бота нет прав ViewAuditLog или ошибка запроса
        kickData = null;
      }

      try {
        await logMemberLeave(member.guild, { member, kickData });
      } catch (err) {
        console.error('[Events: GuildMemberRemove] Ошибка при логировании выхода:', err);
      }
    }
  }
];
