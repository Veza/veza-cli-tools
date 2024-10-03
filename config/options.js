export const optionList = [
  {
    name: 'help',
    description: 'Display this usage guide.',
    alias: 'h',
    type: Boolean
  },
  {
    name: 'src',
    description: 'The input files to process.',
    type: String,
    typeLabel: '{underline file} ...'
  },
  {
    name: 'tidy',
    description: 'Use this option to clean up the file of any unused queries (in both the "reports" object and "queries" array), after manually deleting unwanted report "sections"',
    type: Boolean,
    alias: 't',
    default: false
  },
  {
    name: 'name-gen',
    description: 'Test',
    type: Boolean,
    alias: 'g',
    default: false
  },
  {
    name: 'import',
    description: 'Do import',
    type: Boolean,
    alias: 'i',
    default: false
  },
  {
    name: 'info',
    description: 'Get file info',
    type: Boolean,
    default: false
  },     
  {
    name: 'check-query-name',
    description: 'Check if query exists with the same name',
    type: Boolean,
    default: false
  },
  {
    name: 'increment-version',
    description: 'Generate a new name with a version prefix',
    type: Boolean,
    default: false
  },
  {
    name: 'offline',
    description: 'Does not import. Outputs to /out/offline.json',
    type: Boolean,
    default: false
  },
  {
    name: 'debug',
    description: 'Writes to debug.json',
    type: Boolean,
    default: false
  }
]

export const sections = [
  {
    header: 'Veza CLI tools',
    content: 'Tools to make your life at Veza happier'
  },
  {
    header: 'Usage',
    optionList: optionList
  }
]

export const obj_descs = {
  q: 'query',
  r: 'report'
}

export const file_dirs = {
  input: './in',
  output: './out'
}

export const file_paths = {
  input: './in/in.json',
  output: './out/out.json'
}

export const menu =
`
What would you like to do?
(1) Export a Report or Query from the source Veza tenant and save it as './in/in.json'
(2) Prepare the './in/in.json' (update Ids to avoid collisions) and save the result to './out/out.json'
(3) Push the './out/out.json' object to the destination Veza tenant
(4) Check for the existence of a query name in the destination tenant
(5) Display configuration variables
(x) exit
`
;
