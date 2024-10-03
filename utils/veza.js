
import { mkConfig, generateCsv, asString } from "export-to-csv";
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';

const uuidCheck = new RegExp('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$');
const duplicateCheck = new RegExp('A query with this name already exists');

/********************************************************* */

async function delay(delayInms) {
  return new Promise(resolve => setTimeout(resolve, delayInms));
};

export async function get_obj_from_veza(obj_type, obj_id) {

  let full_url;

  console.dir("the global src tenant is: " + global.dest_tenant)

  if (obj_type == 'r') {
    full_url = `${global.src_tenant}/api/private/assessments/metadata/export?report_ids=${obj_id}`;
  }
  else if (obj_type == 'q') {
    // full_url = `${global.src_tenant}/api/v1/assessments/queries/${obj_id}`;
    full_url = `${global.src_tenant}/api/private/assessments/metadata/export?query_ids=${obj_id}`;
  }

  try {
    const res = await fetch(full_url, {
      headers: {
        Authorization: `Bearer ${global.src_api_key}`
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const raw_json = await res.json();

    return raw_json;

  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}

async function getSpecId(spec, uuid) {
  const id = spec.id;
  try {
    await delay(300);
    if (uuid) {
      console.log(`checking query ${id} for collision`);
    }

    const res = await fetch(`${global.dest_tenant}/api/v1/assessments/queries/${id}`, {
      headers: { Authorization: `Bearer ${global.dest_api_key}` }
    });

    // Id exists
    if (res.status == 200) {
      let specB = await res.json();
      specB = specB.value;

      // Only unedited system created queries can be referenced
      if (specB.query_type == 'SYSTEM_CREATED' && specB.created_at == specB.updated_at) {
        return null;
      } else {
        if (specB.query_type  == 'SYSTEM_CREATED') {
          console.log(`SYSTEM query ${specB.name} was modified. Will be duplicated to avoid collision`);
        }
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

export async function info(json_obj) {
    try {
      let queries = json_obj.queries;
      let report = json_obj.reports[0];
      let sections = [];
      if (!report) {
        report = 'noreport';
      } else {
        sections = report.sections;
        report = report.name;
      }
  
      let queryTuples = [];
      queries.forEach(q => {
        const name = q.name;
  
        let from = "";
        try {
          from = q.source_node_types.nodes[0].node_type;
        } catch(er) {}
  
        let section = sections.find(x => { return x.queries.includes(q.id) });
        section = section? section.name : "";
  
        queryTuples.push({
          id: q.id,
          name: name.trim(), 
          risk_level: q.risk_level,
          section: section,
          labels: q.labels.toString(),
          from, 
          to: q.destination_types.toString(), 
          integrationTypes: q.integration_types.toString()
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
  
        return
      });
    } catch(e) {
      console.log(e);
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

export async function doImport(payload) {
  try {
    const res = await fetch(`${global.dest_tenant}/api/private/assessments/metadata/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${global.dest_api_key}`
      },
      body: JSON.stringify(payload)
    });
    console.log(`Import status: ${res.status}`);
    const output = await res.json();
    console.log(JSON.stringify(output, null, 2));
  } catch(e) {
    throw new Error(e);
  }
}

export function generateVersionName(name) {

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

async function val_in_obj(name, obj) {

  for (const q of obj) {

    console.log(`Comparing "${q.name}" to "${name}"`);

    if (q.name) {
      if (q.name.toLowerCase() == name.toLowerCase()) {
        console.log(`Duplicate query name: ${name}`);
        return true;
      }
    }
  }

  return false;
}

// calls out to dest_tenant and checks to see if a query
// name already exists
export async function hasDupName(name) {
  try {
    const filter = name.replaceAll('"', '\\"');

    const url = `${global.dest_tenant}/api/v1/assessments/queries?filter=name+eq+"${filter}"`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${global.dest_api_key}` }
    })

    const results = await res.json();
  
    if (results.values) {

      if (results.values.length === 0) { return false }

      else {
        const r = await val_in_obj(name, results.values);

        return r;
      }
    }
    else { return false }
  } catch (e) {
    console.log(e);
  }
}

function makeLabel(prefix, id) {
  return `${prefix}${id.replaceAll("-", "").replaceAll(/[a-z]/gi, "")}`;
}

export async function updateJSON(bundle) {
  try {

    if (bundle.reports.length > 1) {
      throw new Error('CLI only supports importing 1 report at a time');
    }

    var label;

    // generate a new uuid for this object
    const reportUuid = uuidv4();
    
    if (bundle.reports.length > 0) {
      const suffix = reportUuid.slice(0, 4); // to append to end of report name
      bundle.reports[0].name = bundle.reports[0].name + " " + suffix;
      bundle.reports[0].id = reportUuid;
      label = makeLabel('report', reportUuid);
    } else {
      label = makeLabel('query', reportUuid);
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
    console.log('Done checking for collisions.\nCleaning up...............................................');
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
    // Remove existing, unmodified SYSTEM queries because we don't need to create them.
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

    return JSON.parse(json);
  
  } catch(e) {
    throw new Error(e);
  }
}

async function uniqueNameWithUuid(originalName, uuid) {
  let name = originalName

  // The filter API does not recognize "'" character. Replace it with something else
  name = name.replaceAll("'", '_');
  while (await hasDupName(name)) {
    await delay(300);
    name = generateVersionName(name);
  }

  return name;
}

export async function tidy(bundle) {
  try {
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

/********************************* */
// Unused

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
