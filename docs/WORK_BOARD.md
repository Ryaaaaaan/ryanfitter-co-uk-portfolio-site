# Private personal Work board

Open https://ryanfitter.co.uk/admin/tasks with the existing Cognito account.

The Work board is a private Kanban-style list for workstreams such as Personal,
LoftyCards, LOPT and Portfolio. Tasks can be created, edited, deleted and moved
between To do, In progress, Waiting/blocked and Done. Each task supports a
priority, optional due date and notes. The overview shows counts of active tasks.

- Task records live in the existing private JOB_DATABASE SQLite file, in the
  separate `personal_tasks` table. They are not published on the portfolio.
- All reads require an allowlisted signed-in Cognito session. Writes require a
  matching CSRF token and exact SITE_ORIGIN and enforce revision conflicts.
- Existing job applications, interview entries and CVs are not touched.
- Deployment preserves task records and includes the existing local SQLite
  backup. Configure off-host backup before treating this as your sole archive.
- Stages are moved via the dropdown on each card; custom task tags, drag-and-drop,
  recurring reminders and external calendar synchronisation are not implemented.
- The source data is user-entered only. Nothing is imported automatically from
  LOPT, Shopify, Gmail or ChatGPT.
