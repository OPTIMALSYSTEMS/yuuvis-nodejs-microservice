const eureka = require("eo-discovery");
const express = require("express");

const stompit = require("stompit");
const request = require("request-json");

// Create a express app
const app = express();

let dmsHost;

// server.port=3000

// Start up the express application ...
var listener = app.listen(3000, () => {
  // ... and register with the eureka discovery
  // Hint: If your eureka registry is not on localhost, you must provide a EUREKA_HOST environment variable.
  var startup = async () => {
    var discovery = await eureka.init({
      name: "stateservice", // We need a name for the service, so others can use it.
      express: app, // The express app is used to provide the discovery endpoints
      port: listener.address().port // This is the public port for the registry, we just pass the express listener port
    });

    dmsHost = discovery.getAppUrl("DMS");

    console.log("Service manager node address : " + dmsHost);

    app.get("/list", (req, res) =>
      res.send({
        config: {
          // configuration with respect to the behavior of the catalog fields,
          // where entries can have entries themselves, and where only leaves should be selectable
          allelementsselectable: false,
          valueField: "listvalue", //optional. if not given, the name 'value' is used
          subEntriesField: "subentries" //optional. if not given, the name 'entries' is used
        },
        entries: [
          // prepare a tree
          {
            listvalue: "Germany",
            subentries: [
              {
                listvalue: "Berlin"
              },
              {
                listvalue: "Bavaria"
              }
            ]
          },
          {
            listvalue: "USA",
            subentries: [
              {
                listvalue: "California"
              },
              {
                listvalue: "Texas"
              }
            ]
          }
        ]
      })
    );
  };

  // Call the async startup function
  startup();

  // stompit

  var connectOptions = {
    host: "localhost",
    port: 61777,
    connectHeaders: {
      host: "/",
      "heart-beat": "5000,5000"
    }
  };

  var reconnect = () => {
    setTimeout(() => {
      console.log("Trying to reconnect");
      connect();
    }, 5000);
  };

  var connect = () => {
    stompit.connect(
      connectOptions,
      function(error, client) {
        if (error) {
          console.log("connect error " + error.message);
        } else {
          console.log('connected');
        }

        client.on("error", error => {
          console.log('Messaging client error : ', error);
          reconnect();
        });

        /**
      var sendHeaders = {
        'destination': '/queue/test',
        'content-type': 'text/plain'
      };
      
      var frame = client.send(sendHeaders);
      frame.write('hello');
      frame.end();
      **/

        var subscribeHeaders = {
          destination: "/topic/indexDataChanged",
          ack: "client-individual"
        };

        client.subscribe(subscribeHeaders, function(error, message) {
          if (error) {
            console.log("subscribe error " + error.message);
            return;
          }

          message.readString("utf-8", function(error, body) {
            if (error) {
              console.log("read message error " + error.message);
              return;
            }

            let msgData = JSON.parse(body);
            console.log("received message: ", msgData.messages[0].itemid);
            client.ack(message);

            var httpclient = request.createClient(dmsHost + "/");

            let dmsReq = "/rest-ws/service/dms/" + msgData.messages[0].itemid;

            httpclient.get(dmsReq, function(err, res, body) {
              return console.log(body);
            });
          });
        });
      }
    );
  };

  connect();
});
