export const typeDefs = `#graphql
  enum Role {
    DEVELOPER
    MAINTAINER
    ADMIN
  }

  enum IssueStatus {
    OPEN
    IN_PROGRESS
    RESOLVED
    CLOSED
  }

  enum IssuePriority {
    LOW
    MEDIUM
    HIGH
    URGENT
  }

  enum SortDirection {
    ASC
    DESC
  }

  enum ProjectSortField {
    CREATED_AT
  }

  enum IssueSortField {
    PRIORITY
    CREATED_AT
    STATUS
  }

  enum ProjectRole {
    OWNER
    MAINTAINER
    MEMBER
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: Role!
    skills: [String!]!
    projects: [Project!]!
    assignedIssues: [Issue!]!
    createdAt: String!
  }

  type Project {
    id: ID!
    title: String!
    description: String!
    techStack: [String!]!
    owner: User!
    members: [ProjectMember!]!
    issues: [Issue!]!
    createdAt: String!
  }

  type ProjectMember {
    id: ID!
    user: User!
    project: Project!
    role: ProjectRole!
    createdAt: String!
  }

  type Issue {
    id: ID!
    title: String!
    description: String!
    status: IssueStatus!
    priority: IssuePriority!
    project: Project!
    createdBy: User!
    assignedTo: User
    comments(first: Int, after: String): CommentConnection!
    createdAt: String!
  }

  type Comment {
    id: ID!
    message: String!
    issue: Issue!
    author: User!
    createdAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type ProjectEdge {
    cursor: String!
    node: Project!
  }

  type ProjectConnection {
    edges: [ProjectEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type IssueEdge {
    cursor: String!
    node: Issue!
  }

  type IssueConnection {
    edges: [IssueEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type CommentEdge {
    cursor: String!
    node: Comment!
  }

  type CommentConnection {
    edges: [CommentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
    skills: [String!]!
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input CreateProjectInput {
    title: String!
    description: String!
    techStack: [String!]!
    ownerId: ID!
  }

  input CreateIssueInput {
    projectId: ID!
    title: String!
    description: String!
    assignedToId: ID
  }

  input ProjectFilterInput {
    search: String
    techStack: String
    ownerId: ID
    createdAfter: String
    createdBefore: String
  }

  input ProjectSort {
    field: ProjectSortField = CREATED_AT
    direction: SortDirection = DESC
  }

  input IssueFilterInput {
    status: IssueStatus
    assignedToId: ID
    assignedToMe: Boolean
    projectId: ID
    createdById: ID
    createdByMe: Boolean
  }

  input IssueSort {
    field: IssueSortField = CREATED_AT
    direction: SortDirection = DESC
  }

  type Query {
    health: String!
    me: User
    users: [User!]!
    projects(first: Int, after: String, filter: ProjectFilterInput, sort: ProjectSort): ProjectConnection!
    project(id: ID!): Project
    issues(first: Int, after: String, filter: IssueFilterInput, sort: IssueSort): IssueConnection!
    issue(id: ID!): Issue
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!

    createProject(input: CreateProjectInput!): Project!
    deleteProject(id: ID!): Boolean!
    addProjectMember(projectId: ID!, userId: ID!, role: ProjectRole = MEMBER): ProjectMember!
    createIssue(input: CreateIssueInput!): Issue!
    updateIssueStatus(issueId: ID!, status: IssueStatus!): Issue!
    assignIssue(issueId: ID!, userId: ID!): Issue!
    addComment(issueId: ID!, message: String!): Comment!
  }

  type Subscription {
    issueStatusChanged(projectId: ID!): Issue!
    commentAdded(issueId: ID!): Comment!
    issueAssigned(userId: ID!): Issue!
  }
`;
