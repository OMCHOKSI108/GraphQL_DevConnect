# Test Queries

Runnable `.graphql` files for manually exercising the API — import these into
Apollo Sandbox, Postman, Insomnia, or the VS Code GraphQL extension and run
each named operation individually. Variable examples are included as comments
above each operation.

| File                  | Covers                                                        |
| ----------------------- | ------------------------------------------------------------------ |
| `auth.graphql`         | Register, Login, Me                                          |
| `projects.graphql`     | Create/delete project, add member, paginated/filtered/sorted projects, single project |
| `issues.graphql`       | Create issue, assign issue, update status, paginated/filtered/sorted issues, single issue |
| `comments.graphql`     | Add comment, paginated issue comments                        |
| `subscriptions.graphql`| issueStatusChanged, commentAdded, issueAssigned (WebSocket)   |

For narrative examples with full explanations, see
[`docs/graphql-examples.md`](../graphql-examples.md) instead — these files are
meant to be pasted directly into a client, not read top to bottom.
