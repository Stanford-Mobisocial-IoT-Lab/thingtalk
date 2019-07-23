"use strict";

const AppGrammar = require("../lib/grammar_api");
const SchemaRetriever = require("../lib/schema");
const SparqlConverter = require("../lib/sparql_converter");
const SPARQLQueryDispatcher = require("./sparql_query");
const SparqlQuery = new SPARQLQueryDispatcher();

const _mockSchemaDelegate = require("./mock_schema_delegate");
const _mockMemoryClient = require("./mock_memory_client");
var assert = require("assert");

const _schemaRetriever = new SchemaRetriever(
  _mockSchemaDelegate,
  _mockMemoryClient,
  true
);

async function main() {
  //thingtalk code
  const code = [
    `
    // Filter for person who has last name Curry, plays Basketball, and project for Father
    now => [P22] of @org.wikidatasportsskill.athlete(), P734 == "Curry"
    && P641 == ["Q5372"^^org.wikidatasportsskill:sports] => notify;
    `,
    `
    // Filter for person who was born on September 29, 1988, and plays Football
    now => @org.wikidatasportsskill.athlete(), P569 == makeDate(1977, 8, 4)
    && P641 == ["Q41323"^^org.wikidatasportsskill:sports] => notify;
    `,
    `
    // Filter for person who was 231 cm and plays Basketball
    now => @org.wikidatasportsskill.athlete(), P2048 == 231cm
    && P641 == ["Q5372"^^org.wikidatasportsskill:sports] => notify;
    `,
    `
    // Filter for person who was drafted by the cavs and won the MVP award
    now => @org.wikidatasportsskill.athlete(),
    P647 == "Q162990"^^org.wikidatasportsskill:sports_teams("Cleveland Cavaliers")
    && P166 == ["Q222047"^^org.wikidatasportsskill:award_received("NBA Most Valuable Player Award")] => notify;
    `,
    `
    // Filter for person who played for the Lakers and Warriors
    now => @org.wikidatasportsskill.athlete(),
    P54 == ["Q121783"^^org.wikidatasportsskill:sports_teams("Los Angeles Lakers"),
    "Q157376"^^org.wikidatasportsskill:sports_teams("Golden State Warriors")] => notify;
    `,
    `
    // Join for team Steve Kerr coaches (Warriors) and players who were drafted by that team
    now => (([sports_team, P286] of @org.wikidatasportsskill.sports_team(),
    P286 == "Q523630"^^org.wikidata:human('Steve Kerr'))
    join ([P647] of @org.wikidatasportsskill.athlete())), P647 == sports_team => notify;
    `,

    `
    // Filter for person who has last name Curry, plays Basketball, and get the second result
    now => @org.wikidatasportsskill.athlete()[1:2], P734 == "Curry"
    && P641 == ["Q5372"^^org.wikidatasportsskill:sports] => notify;
    `
  ];
  const answers = [
    "Dell Curry",
    "Tom Brady",
    "Gheorghe Mureșan",
    "LeBron James",
    "Wilt Chamberlain",
    "Klay Thompson",
    "Michael Curry"
  ];

  Promise.all(
    code.map((code) => {
      let promise = new Promise((resolve, reject) => {
        code = code.trim();
        AppGrammar.parseAndTypecheck(code, _schemaRetriever).then(
          async (program) => {
            //convert from ast to sparql
            const sparqlQuery = await SparqlConverter.toSparql(program);
            SparqlQuery.query(sparqlQuery[0])
              .then((response) => {
                let query_output = [];
                let result = response["results"]["bindings"];
                let start = 0;
                let end = result.length;

                if (sparqlQuery[1][0] !== 0 || sparqlQuery[1][1] !== 0) {
                  start = sparqlQuery[1][0];
                  end = sparqlQuery[1][1];
                }

                for (var i = start; i < end; i++) {
                  //if there is not a join
                  let output_var = "v%sLabel".format(sparqlQuery[2]);

                  let output = result[i][output_var]["value"];
                  query_output.push(output);
                }

                resolve(query_output);
              })
              .catch((error) => {
                console.log(error);
                resolve(undefined);
              });
          }
        );
      });
      return promise;
    })
  ).then((values) => {
    for (var i = 0; i < values.length; i++)
      assert.strictEqual(answers[i], values[i][0]);
  });
}

module.exports = main;
if (!module.parent) main();
