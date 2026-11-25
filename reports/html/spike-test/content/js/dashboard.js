/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 79.74919957310566, "KoPercent": 20.250800426894344};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.5257513825438808, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.6036496350364964, 500, 1500, "Get Account Balance"], "isController": false}, {"data": [0.5530413625304136, 500, 1500, "Delete Beneficiary (DELETE)"], "isController": false}, {"data": [0.1335766423357664, 500, 1500, "Update Profile (PUT)"], "isController": false}, {"data": [0.589051094890511, 500, 1500, "Initiate Transfer"], "isController": false}, {"data": [0.6046228710462287, 500, 1500, "Get Profile"], "isController": false}, {"data": [0.43990267639902675, 500, 1500, "Transfer Flow (Transaction Controller)"], "isController": true}, {"data": [0.5845652173913043, 500, 1500, "Login"], "isController": false}, {"data": [0.5318734793187347, 500, 1500, "Get Transfer Status"], "isController": false}, {"data": [0.6058394160583942, 500, 1500, "Get Transaction History"], "isController": false}, {"data": [0.6043795620437956, 500, 1500, "Add Beneficiary (POST)"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 18740, 3795, 20.250800426894344, 458.7837246531487, 5, 968, 627.0, 805.0, 839.0, 885.0, 55.07731102810001, 19.11255100584425, 15.59383888251692], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["Get Account Balance", 2055, 184, 8.953771289537713, 461.37274939172806, 5, 968, 627.0, 802.4000000000001, 836.0, 883.44, 6.122175383194554, 1.5597535861647773, 1.5664159671845441], "isController": false}, {"data": ["Delete Beneficiary (DELETE)", 2055, 374, 18.199513381995136, 458.4082725060816, 6, 948, 625.0, 801.0, 835.0, 886.44, 6.12560622635829, 1.506236246262784, 1.7034309775707426], "isController": false}, {"data": ["Update Profile (PUT)", 2055, 1765, 85.88807785888078, 445.6311435523121, 5, 937, 622.0, 818.0, 849.1999999999998, 896.8800000000001, 6.12170120736034, 1.8038235870190147, 1.7755324790879112], "isController": false}, {"data": ["Initiate Transfer", 2055, 233, 11.338199513381996, 454.42238442822213, 6, 932, 627.0, 816.4000000000001, 852.0, 892.44, 6.1252593175477505, 2.0774628274256624, 2.2909905455281137], "isController": false}, {"data": ["Get Profile", 2055, 194, 9.440389294403893, 450.0379562043792, 6, 936, 623.0, 805.0, 839.0, 881.0, 6.1218470997935555, 1.8090623724615187, 1.5185050423316047], "isController": false}, {"data": ["Transfer Flow (Transaction Controller)", 2055, 464, 22.579075425790755, 907.2798053527979, 27, 1805, 874.0, 1570.0, 1626.0, 1723.0, 6.121008313252653, 4.068277888378723, 3.8461516533796605], "isController": true}, {"data": ["Login", 2300, 245, 10.652173913043478, 467.28478260869446, 7, 921, 639.0, 804.0, 836.0, 884.9899999999998, 6.848417717749908, 2.1293804517499195, 1.8324867721322995], "isController": false}, {"data": ["Get Transfer Status", 2055, 464, 22.579075425790755, 452.8574209245741, 7, 949, 625.0, 805.0, 838.1999999999998, 885.3200000000002, 6.125113262435023, 1.9935929182289926, 1.557795091489222], "isController": false}, {"data": ["Get Transaction History", 2055, 170, 8.27250608272506, 465.05985401459844, 6, 926, 629.0, 797.0, 833.0, 882.0, 6.1223942583561, 4.777711864075399, 1.6441976768046165], "isController": false}, {"data": ["Add Beneficiary (POST)", 2055, 166, 8.077858880778589, 472.9654501216557, 6, 910, 634.0, 797.0, 825.7999999999993, 872.0, 6.125350605530402, 1.7190726381259112, 1.9201538519289638], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["503/Service Unavailable", 1895, 49.93412384716733, 10.11205976520811], "isController": false}, {"data": ["404/Not Found", 394, 10.382081686429512, 2.1024546424759873], "isController": false}, {"data": ["Assertion failed", 1506, 39.683794466403164, 8.036286019210246], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 18740, 3795, "503/Service Unavailable", 1895, "Assertion failed", 1506, "404/Not Found", 394, "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": ["Get Account Balance", 2055, 184, "503/Service Unavailable", 184, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["Delete Beneficiary (DELETE)", 2055, 374, "503/Service Unavailable", 211, "404/Not Found", 163, "", "", "", "", "", ""], "isController": false}, {"data": ["Update Profile (PUT)", 2055, 1765, "Assertion failed", 1506, "503/Service Unavailable", 259, "", "", "", "", "", ""], "isController": false}, {"data": ["Initiate Transfer", 2055, 233, "503/Service Unavailable", 233, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["Get Profile", 2055, 194, "503/Service Unavailable", 194, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": ["Login", 2300, 245, "503/Service Unavailable", 245, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["Get Transfer Status", 2055, 464, "503/Service Unavailable", 233, "404/Not Found", 231, "", "", "", "", "", ""], "isController": false}, {"data": ["Get Transaction History", 2055, 170, "503/Service Unavailable", 170, "", "", "", "", "", "", "", ""], "isController": false}, {"data": ["Add Beneficiary (POST)", 2055, 166, "503/Service Unavailable", 166, "", "", "", "", "", "", "", ""], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
