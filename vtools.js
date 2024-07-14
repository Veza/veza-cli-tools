import 'dotenv/config';
import fs from 'node:fs';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import isEqual from 'lodash.isequal';
import { v4 as uuidv4 } from 'uuid';
import readline from 'readline';
import { mkConfig, generateCsv, asString } from "export-to-csv";
import { Buffer } from "node:buffer";


const uuidCheck = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
const duplicateCheck = new RegExp('A query with this name already exists');

async function listSavedQueries() {
  const res = await fetch(
    `${process.env.VEZA_URL}/api/v1/assessments/queries`, {
    headers: {
      Authorization: `Bearer ${process.env.VEZA_KEY}`
    }
  })
  const specs = await res.json()
  let queries = []
  for (const q of specs.values) {
    queries.push(q.id)
  }
  console.log(queries)
}

function trimSpec(spec) {
  const includeFields = [
    'id',
    'name', 'description',
    'variables',
    'no_relation', 'include_nodes', 'query_type', 
    'source_node_types', 'relates_to_exp', 'node_relationship_type', 'result_value_type', 
    'include_all_source_tags_in_results', 'include_all_destination_tags_in_results',
    'labels',
    'risk_level', 'risk_explanation', 'risk_remediation',
    'visibility'
  ]
  
  Object.keys(spec).forEach(k => {
    if (!includeFields.includes(k)) {
      delete spec[k]
    }
  })
  return spec;
}

function parseSpec(spec, embeddeds) {
  if (['string', 'boolean'].includes(typeof spec))  return spec;

  if (!spec) return null;

  let specNew = {};

  Object.keys(spec).forEach(k => {
    let v = spec[k];
    let type = typeof v;
    if (type == 'object') {
      if (Array.isArray(v)) {
        type = 'array';
        let newV = []
        v.forEach(i => {
          newV.push(parseSpec(i, embeddeds));
        })
        v = newV
      } else {
        v = parseSpec(v, embeddeds);
      }
    }    

    if (k == 'value' && uuidCheck.test(v)) {
      embeddeds.push(v);
      v = 'new_query'
    }

    specNew[k] = v

  })

  return specNew;
}

function loadQueryJson(file) {
  let specNew = null;
  try {
    const json = fs.readFileSync(file, 'utf-8');    
    const spec = JSON.parse(json);
    let embeddeds = [];
    specNew = trimSpec(parseSpec(spec, embeddeds));

    if (embeddeds.length > 0) {
      console.log(embeddeds);
    }
  } catch(e) {
    console.log(e);
  }
  return specNew;
}


function embeddedQueries(query, allQueries, wantedQueries) {

  wantedQueries.push(query);

  let embeddeds = [];
  parseSpec(query, embeddeds);

  embeddeds.forEach(id => {
    const embeddedQuery = allQueries.find(q => { return q.id == id });
    if (embeddedQuery) {
      const found = wantedQueries.find(q => { return q.id == id });
      if (!found) {
        embeddedQueries(embeddedQuery, allQueries, wantedQueries);
      }  
    }
  });
}

function info(file) {
  try {
    const json = fs.readFileSync(file, 'utf-8');    
    const bundle = JSON.parse(json);
    let queries = bundle.queries;
    let report = bundle.reports[0];
    if (!report) {
      report = 'noreport';
    } else {
      report = report.name;
    }

    console.log(`# queries: ${queries.length}`);
    let queryTuples = [];
    queries.forEach(q => {
      const name = q.name;
      let from = "";
      try {
        from = q.source_node_types.nodes[0].node_type;
      } catch(er) {}
      const to = q.destination_types
      const integrationTypes = q.integration_types;
      queryTuples.push({
        name: name.trim(), 
        from, 
        to: to.toString(), 
        integrationTypes: integrationTypes.toString()
      });
    });
    const filename = `./out/${report}.info.csv`;
    const csvConfig = mkConfig({
      useKeysAsHeaders: true,
      filename: filename
    });
    const csv = generateCsv(csvConfig)(queryTuples);
    const csvBuffer = new Uint8Array(Buffer.from(asString(csv)));
    fs.writeFile(filename, csvBuffer, (err) => {
      if (err) throw err;
      console.log("Result saved to file: ", filename);
    });
  } catch(e) {
    console.log(e);
  }
}

function tidy(file) {
  try {
    const json = fs.readFileSync(file, 'utf-8');    
    const bundle = JSON.parse(json);
    let report = bundle.reports[0];

    let includeQueries = [];
    const sections = report.sections;
    sections.forEach(section => {
      includeQueries = includeQueries.concat(section.queries);
    })

    let cleanedQueries = [];
    report.queries.forEach(q => {
      if (includeQueries.includes(q.query)) {
        cleanedQueries.push(q);
      }
    })
    report.queries = cleanedQueries;

    console.log(`queries count: ${bundle.queries.length}`);
    let wantedQueries = [];
    const queries = bundle.queries;
    includeQueries.forEach(id => {
      const query = queries.find(q => { return q.id == id });
      embeddedQueries(query, queries, wantedQueries)
    });
    console.log(`trimmed count: ${wantedQueries.length}`);

    bundle.queries = [];
    wantedQueries.forEach(q => {
      bundle.queries.push(trimSpec(q));
    });
    
    return bundle;
  } catch(e) {
    console.log(e);
  }  
}

function labelFromReportName(reportName) {
  return `report${reportName.replaceAll("-", "").replaceAll(/[a-z]/gi, "")}`;
}

async function importFile(file) {
  try {
    let contents = fs.readFileSync(file, 'utf-8');
    let bundle = JSON.parse(contents);

    if (bundle.reports.length > 1) {
      throw new Error('CLI only supports importing 1 report at a time');
    }

    var label;
    const reportUuid = uuidv4();
    console.log(`Importing with id ${reportUuid}`);
    if (bundle.reports.length > 0) {
      bundle.reports[0].id = reportUuid;
      label = labelFromReportName(reportUuid);
    } else {
      label = labelFromReportName(reportUuid);
    }

    let queries = bundle.queries;
    queries.forEach(q => {
      if (q.labels) {
        q.labels.push(label);
      } else {
        q.labels = [label];
      }      
    });

    const dedupedIds = await dedupQueries(queries, reportUuid);

    await delay(1000);
    console.log('Done checking for collissions.\nCleaning up...............................................');
    await delay(2300);

    const qLength = queries.length;
    let i = 0;
    // Update query name to avoid name collision
    Object.keys(dedupedIds).forEach(k => {
      const index = queries.findIndex(q => { return q.id == k; });
      if (index > -1) {
        if (dedupedIds[k]) {
          // all queries should be SOURCE_TO_DESTINATION
          queries[index].query_type = 'SOURCE_TO_DESTINATION';

          if (dedupedIds[k].name != queries[index].name ) {
            queries[index].name = dedupedIds[k].name;
            console.log(`Update query name to avoid collision: ${queries[index].name}`);
            i++;
          }          
        }
      }
    })

    let j = 0;
    // Remove existing queries because we don't need to create them.
    Object.keys(dedupedIds).forEach(k => {
      const index = queries.findIndex(q => { return q.id == k; });
      if (index > -1) {
        if (!dedupedIds[k]) {
          console.log(`Remove existing query ${k} from payload`)
          queries.splice(index, 1);
          j++;
        }
      }
    }) 

    bundle.queries = queries;
    let json = JSON.stringify(bundle);

    let z = 0;
    Object.keys(dedupedIds).forEach(k => {
      if (dedupedIds[k] && k != dedupedIds[k].id) {
        console.log(`Replace colliding query id ${k} with new id ${dedupedIds[k].id}`);
        json = json.replaceAll(k, dedupedIds[k].id);
        z++;
      }
    })

    console.log('---------------------\nSUMMARY:');
    console.log(` # of queries in the original file: ${qLength}`);
    console.log(` # of query names updated to avoid collision: ${i}`);
    console.log(` # of queries removed from the payload because it can be re-referenced: ${j}`);
    console.log(` # of new query Ids generated so that we avoid collision: ${z}`);

    return JSON.stringify(JSON.parse(json), null, 2);
  } catch(e) {
    throw new Error(e);
  }
}

async function doImport(payload) {
  try {
    const res = await fetch(`${process.env.VEZA_URL}/api/private/assessments/metadata/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VEZA_KEY}`
      },
      body: payload
    });
    console.log(`Import status: ${res.status}`);
    const output = await res.json();
    console.log(JSON.stringify(output, null, 2));
  } catch(e) {
    throw new Error(e);
  }
}

async function dedupQueries(queries, uuid) {
  let dedupedIds = {}
  try {
    for(const q of queries) {
      dedupedIds[q.id] = await getSpecId(q, uuid);
    }
  } catch(e) {
    throw new Error(e);
  }
  return dedupedIds;
}

async function delay(delayInms) {
  return new Promise(resolve => setTimeout(resolve, delayInms));
};

async function getSpecId(spec, uuid) {
  const id = spec.id;
  try {
    await delay(300);
    if (uuid) {
      console.log(`checking query ${id} for collision`);
    }

    const res = await fetch(`${process.env.VEZA_URL}/api/v1/assessments/queries/${id}`, {
      headers: { Authorization: `Bearer ${process.env.VEZA_KEY}` }
    });

    // Id exists
    if (res.status == 200) {
      let specB = await res.json();
      specB = specB.value;

      // Only unedited system created queries can be referenced
      if (specB.query_type == 'SYSTEM_CREATED' && specB.created_at == specB.updated_at) {
        return null;
      } else {
        // Otherwise create a new query from the provided spec, even if the definitions are the same.
        let specC = JSON.parse(JSON.stringify(spec));
        specC.name = await uniqueNameWithUuid(spec.name, uuid); // Make sure name does not collide
        specC.id = uuidv4(); // Generate new uuid
        return await getSpecId(specC);
      }

      // let embeddeds = [];
      // specB = trimSpec(parseSpec(specB, embeddeds));
      // embeddeds = [];
      // const specA = trimSpec(parseSpec(spec, embeddeds));
      // if (isEqual(specA, specB)) {
      //   return null;
      // } else {
      //   let specC = JSON.parse(JSON.stringify(spec));
      //   specC.name = await uniqueNameWithUuid(spec.name, uuid);
      //   specC.id = uuidv4();
      //   return await getSpecId(specC, uuid);
      // }
    }
  } catch(e) {
    throw new Error(`Abort: ${e}`);
  }
  return { id: spec.id, name: spec.name };
}

async function uniqueNameWithUuid(originalName, uuid) {
  let name = originalName

  // The filter API does not recognize "'" character. Replace it with something else
  name = name.replaceAll("'", '_');
  while (await hasDupName(name)) {
    await delay(300);
    name = generateVersionName(name);
  }

  // if (uuid) {
  //   name = `${name} ${uuid}`;
  // }

  return name;
}

function generateVersionName(name) {
  const exp1 = new RegExp("\\([0-9]+\\)$", "g");
  const str = `${name}`.trim();

  let array1, found, lastIndex = -1;
  while ((array1 = exp1.exec(str)) !== null) {
    found = array1[0];
    lastIndex = exp1.lastIndex;
  }
  if (lastIndex > 0) {
    const nextCounter = parseInt(found.replace("(", "").replace(")", "")) + 1;
    return `${str.substring(0, str.length - found.length)}(${nextCounter})`;
  } else {
    return `${str} (1)`;
  }
}

async function hasDupName(name) {
  try {
    const filter = name.replaceAll('"', '\\"');
    const url = `${process.env.VEZA_URL}/api/v1/assessments/queries?filter=name+eq+"${filter}"`;
    // console.log(url);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.VEZA_KEY}` }
    })
    const results = await res.json();
    if (results.values) {
      for (const q of results.values) {
        if (q.name == name) {
          console.log(`Duplicate query name: ${name}`);
          return true;
        }
      }
    }
  } catch (e) {
    console.log(e);
  }
  return false;
}

async function saveQuery(spec) {
  try {
    if (spec.query_type = 'SYSTEM_CREATED') {
      spec.query_type = 'SOURCE_TO_DESTINATION';
    }

    console.log(`Saving query with name: ${spec.name}`)      
    const res = await fetch(`${process.env.VEZA_URL}/api/v1/assessments/queries`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.VEZA_KEY}`
      },
      body: JSON.stringify(spec)
    });
    const response = await res.json();
    if (res.status == 200) {
      return response.value.id;
    }
    let handleDupName = false;
    response.details.forEach(d => {
      if (d.field_violations) {
        d.field_violations.forEach(v => {
          if (duplicateCheck.test(v.description)) {
            handleDupName = true;    
          }
        });  
      }
    });
    if (handleDupName) {
      spec.name = `${spec.name} (2)`;
      return await saveQuery(spec);
    } else {
      throw new Error(JSON.stringify(response.details));
    }
  } catch(e) {
    throw new Error(e);
  }
}

async function main() {
  const optionList = [
    {
      name: 'src',
      description: 'The input files to process.',
      type: String,
      typeLabel: '{underline file} ...'
    },
    {
      name: 'help',
      description: 'Display this usage guide.',
      alias: 'h',
      type: Boolean
    },
    {
      name: 'tidy',
      description: 'Use this option to cleanup the file off any unused queries (in both the "reports" object and "queries" array), after manually deleting unwanted report "sections"',
      type: Boolean,
      alias: 't',
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
    },    
  ]
  
  const sections = [
    {
      header: 'Veza CLI tools',
      content: 'Tools to make your life at Veza happier'
    },
    {
      header: 'Usage',
      optionList: optionList
    }
  ]

  const options = commandLineArgs(optionList);

  if (options['check-query-name'] || options['increment-version']) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question("Enter value to check: ", (name) => {
      if (options['check-query-name'])
        hasDupName(name);
      else
        console.log(generateVersionName(name));
      rl.close();
    })    
    return;
  }



  if (Object.keys(options).length == 0 
    || (Object.keys(options).length == 1 && options['src'])
    || options.help
  ) {
    const usage = commandLineUsage(sections);
    console.log(usage);
    return;
  }

  const fileLocation = options.src;

  if (!fileLocation) {
    console.log("\n\n");
    console.log("### Please specify the file with the --src option.");
    const usage = commandLineUsage([sections[1]]);
    console.log(usage);
    return;
  }

  if (!fs.existsSync(fileLocation)) {
    console.log(`File "${fileLocation}" not found`);
    return;
  }

  if (options['tidy']) {
    const contents = tidy(fileLocation);
    try {
      let newFile = `${fileLocation.split('.json')[0]}-tidy.json`;
      fs.writeFileSync(newFile, JSON.stringify(contents, null, 2));
    } catch(e) {
      console.log(e);
    }
    return;
  }

  if (options['info']) {
    info(fileLocation);
    return;
  }

  if (options['import'] || options['offline']) {
    try {
      const payload = await importFile(fileLocation);
      if (options['offline']) {
        fs.writeFileSync('./out/offline.json', payload);
      } else {
        if (options['offline']) {
          fs.writeFileSync('debug.json', payload);
        }
        doImport(payload);
      }
    } catch(e) {
      console.log(JSON.stringify(e, null, 2));
    }
    return;
  }
}

main()
