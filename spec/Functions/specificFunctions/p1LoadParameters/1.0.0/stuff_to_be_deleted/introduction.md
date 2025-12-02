## Why is a solution to the parameter handling needed?  

**Problem:**  
Applications get more sub-structured into Functions (code segments with JavaScript interface).  
Many Functions need parameters.  
Some (generic) Functions shall be re-used in different applications.  

For example,  
- the DPMDP will be sub-structured into >10 Functions  
- It has to process ~40.ooo devices in 3hours  
  => ~ 4 devices per second  
- If each Function would read its parameters from the configFile  
  => 40 file accesses per second  

=> A harmonized way of storing parameters in the configFile does not suffice.  

**Potential Solution:**  
Parameters shall be ...  
- ... loaded once at the begin of the application execution, or at least processing  
- ... provided to the Functions when they are called  

Parameter handling shall be generic, which means ...  
- ... higher layer Functions shall be transparent to the parameters of lower layer Functions  
- ... lower layer Functions shall not require adaptions to be re-used in different applications  
- ... parameter definitions shall be possible in a central place (e.g. configFile)  
- ... coordination of parameter names across Functions shall not be required  
- ... it shall be possible to use different parameter sets for the same Function, if applied in a different context, even within the same application  

Idea:  
- Parameters shall have hierarchy  
- Hierarchy shall be implemented by recursive objects  
