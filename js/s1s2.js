/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=8 sts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var S1S2 = null;
var SELECTED_TEAM = "";
var S1S2_CONFIG_ID = "1759920";

$(document).ready(function () {
    $("#applySettingsButton").click(function() {
        var x = $("form").serializeArray();
        var values = {};
        $.each(x, function(i, field) {
            values[field.name] = field.value;
        });

        var close_settings = true;
        var use_local = JSON.stringify(values).includes("remember");

        // API key
        var old_api_key = "";
        var key = sessionStorage.getItem("api-key");
        if(key == null) {
            key = localStorage.getItem("api-key");
        }
        if(key != null) {
            old_api_key = key;
        }

        if(old_api_key != values.key) {
            if(use_local) {
                localStorage.setItem("api-key", values.key);
            } else {
                sessionStorage.setItem("api-key", values.key);
            }
            close = false;
        }

        if(close) {
            closeSettings();
        }
        else {
            window.location.reload(true);
        }
    });

    window.onclick = function (event) {
        var modal = document.getElementById('settingsPopup');
        if (event.target == modal) {
          closeForm();
        }
      }

    main();
});

function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}

function main()
{
    // retrieve the dashboard configuration from Bugzilla
    // (we use it for all kind of other things, why not a NoSQL database? ;) 
    var url = "https://bugzilla.mozilla.org/rest/bug/" + S1S2_CONFIG_ID + "/comment";
    retrieveConfiguration(url);
}

function retrieveConfiguration(url)
{
    $.ajax({
        url: url,
        success: function(data) {
            var count = data.bugs[S1S2_CONFIG_ID].comments.length;
            --count;

            // find the last comment that has valid JSON data
            while(count) {
                var text = data.bugs[S1S2_CONFIG_ID].comments[count].raw_text
                try {
                    S1S2 = JSON.parse(text);
                    break;
                }
                catch(e) {
                    --count;
                }
            }

            if(count < 1) {
                alert("Failed to locate parseable JSON data in " + S1S2_CONFIG_ID);
            }
            else {
                var api_key = sessionStorage.getItem("api-key");
                if(api_key == null) {
                    api_key = localStorage.getItem("api-key");
                }
                S1S2.api_key = (api_key == null) ? "" : api_key;
    
                var teams = Object.keys(S1S2.teams);
                if(teams.length > 0) {
                    SELECTED_TEAM ="Graphics";  // default to Graphics team

                    var url_vars = getUrlVars();
                    if(url_vars.length != 0 && url_vars.hasOwnProperty("team")) {
                        SELECTED_TEAM = url_vars["team"];
                        if(!S1S2.teams.hasOwnProperty(SELECTED_TEAM)) {
                            SELECTED_TEAM ="Graphics";  // default to Graphics team
                        }
                    }

                    $("#subtitle").replaceWith("<div id=\"subtitle\" class=\"subtitle\">Team: " + SELECTED_TEAM + "</div>");
    
                    var team_data = S1S2.teams[SELECTED_TEAM];
                    prepPage(team_data, "current");
        
                    var url = S1S2.bugzilla_rest_url;
                    if(S1S2.api_key.length) {
                        url += "api_key=" + S1S2.api_key + "&";
                    }
                    var components = ""
                    for (var key in team_data.components) {
                        if(components.length) {
                            components += "&"
                        }
                        var id = team_data.components[key];
                        components += "component=" + encodeURIComponent(id)
                    }
                
                    url += S1S2.fields_query.replace("{components}", components);
                    retrieveInfoFor(url, key);
                }
            }
        }
    })
    .error(function(jqXHR, textStatus, errorThrown) {
        console.log("error " + textStatus);
        console.log("incoming Text " + jqXHR.responseText);
    });
}

// this function's sole reason for existing is to provide
// a capture context for the AJAX values...
function retrieveInfoFor(url, key)
{
    $.ajax({
        url: url,
        success: function(data) {
            displayCountFor(key, data);
        }
    })
    .error(function(jqXHR, textStatus, errorThrown) {
        console.log("error " + textStatus);
        console.log("incoming Text " + jqXHR.responseText);
    });
}

// generate random integer in the given range
function randomNumber(min, max) { 
    return Math.round(Math.random() * (max - min) + min);
}

function prepPage(team_data, displayType)
{
    $("#header-bg").attr("class", "header-bg header-bg-" + displayType);
    if (displayType != "current") {
        $("#title").attr("class", "title-light");
        $("#subtitle").attr("class", "subtitle title-light");
    }

    var col = 0;

    var content = "<div class=\"component\" id=\"component_replace\">";
    content += "<table width=\"80%\">"
    for (var index in team_data.components) {
        if(col == 2) {
            content += "</tr>"
            col = 0;
        }

        if(col == 0) {
            content += "<tr>";
        }

        content += "<td><i><h1>" + team_data.components[index] + "</h1></i></td>";
        ++col;
    }

    if(col != 2) {
        content += "</tr>";
    }
    content += "</table></div>";

    if(content.length) {
        $("#content").replaceWith(content);
    }
}

function displayCountFor(key, data)
{
    var count = data.bugs.length;
    var klass = "data";
    if (S1S2.api_key.length != 0){
        klass += "-validated";
    }

    // organize the data
    var s1s2_map = new Map();

    if(count != 0) {
        var bug_list = S1S2.bugzilla_bug_list;
        var bug_ids = "";
        for (var i = 0; i < data.bugs.length; ++i) {
            var component_id = data.bugs[i].component;
            if(S1S2.teams[SELECTED_TEAM].components.indexOf(component_id) != -1) {
                if(!s1s2_map.hasOwnProperty(component_id)) {
                    s1s2_map[component_id] = new Map();
                    s1s2_map[component_id]["S1"] = new Array();
                    s1s2_map[component_id]["S2"] = new Array();
                }
    
                // this is so I can see the values in the debugger
                var entry_severity = data.bugs[i].severity;
                var entry_assigned = data.bugs[i].assigned_to;
                var entry_id = "" + data.bugs[i].id;
                var entry_summary = data.bugs[i].summary;
                entry_summary = entry_summary.replace("<", "&lt;");
                entry_summary = entry_summary.replace(">", "&gt;");

                // limit summary to 40 characters
                if(entry_summary.length > 40) {
                    entry_summary = entry_summary.substr(0, 37) + "...";
                }

                var entry_values = new Array();
                entry_values.push(entry_id);
                entry_values.push(entry_summary);
                if(S1S2.teams[SELECTED_TEAM].members.hasOwnProperty(entry_assigned)) {
                    entry_values.push(S1S2.teams[SELECTED_TEAM].members[entry_assigned]);
                }
                else {
                    entry_assigned = entry_assigned.replace("<", "&lt;");
                    entry_assigned = entry_assigned.replace(">", "&gt;");
                    entry_values.push(entry_assigned);
                }

                s1s2_map[component_id][entry_severity].push(entry_values);
            }
        }

        // now map the organized data into the component categories
        var content = "<table width=\"80%\" class=\"component_table_collection\">"

        var col = 0;

        for (var index in S1S2.teams[SELECTED_TEAM].components) {
            if(col == 2) {
                content += "</tr>"
                col = 0;
            }
    
            if(col == 0) {
                content += "<tr>";
            }

            var component_id = S1S2.teams[SELECTED_TEAM].components[index]
            var encoded_component_id = encodeURIComponent(component_id)
            var component_map = s1s2_map[component_id]

            var s1_list = S1S2.bugzilla_bug_list;
            var s1_ids = "";
            for(var ii in component_map["S1"]) {
                var fields = component_map["S1"][ii];
                if(s1_ids.length != 0) {
                    s1_ids += ",";
                }
                s1_ids += fields[0];
            }
            s1_list += encodeURIComponent(s1_ids);

            var s2_list = S1S2.bugzilla_bug_list;
            var s2_ids = "";
            for(var ii in component_map["S2"]) {
                var fields = component_map["S2"][ii];
                if(s2_ids.length != 0) {
                    s2_ids += ",";
                }
                s2_ids += fields[0];
            }
            s2_list += encodeURIComponent(s2_ids);

            var s1s2_list = S1S2.bugzilla_bug_list;
            if(s1_ids.length) {
                s1s2_list += encodeURIComponent(s1_ids);
                if(s2_ids.length) {
                    s1s2_list += ",";
                }
            }
            if(s2_ids.length) {
                s1s2_list += encodeURIComponent(s2_ids);
            }

            content += "<td>";
            content += "<table width=\"100%\" class=\"component_table\">";
            content += "<tr class=\"component_id\"><th colspan=\"2\"><a href=\"" + s1s2_list + "\">" + component_id + "</a></th></tr>"
            content += "<tr class=\"component_id_sub\"><th>Severity</th><th>Count</th></tr>"
            if(s1_list.length) {
                content += "<tr><td>S1</td><td>" + component_map["S1"].length + "</td></tr>"
            }
            else {
                content += "<tr><td>S1</td><td><a href=\"" + s1_list + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + component_map["S1"].length + "</a></td></tr>"
            }
            if(s2_list.length) {
                content += "<tr><td>S2</td><td><a href=\"" + s2_list + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + component_map["S2"].length + "</td></tr>"
            }
            else {
                content += "<tr><td>S2</td><td>" + component_map["S2"].length + "</td></tr>"
            }
            content += "</table>"
            content += "</td>";

            ++col;
        }

        $("#component_replace").replaceWith("<div id=\"data_" + encoded_component_id + "\" class=\"" + klass + "\">" + content + "</div>");
    }
}

function openSettings() {
    if(S1S2.api_key.length) {
        var api_key = document.getElementById("api-key");
        api_key.value = S1S2.api_key;
    }

    document.getElementById("popupForm").style.display = "block";
}
  
function closeSettings() {
    document.getElementById("popupForm").style.display = "none";
}
