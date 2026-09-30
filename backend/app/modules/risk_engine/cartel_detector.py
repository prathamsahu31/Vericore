import networkx as nx
from typing import List, Tuple
from app.db.models import Bidder

def detect_cartel_rings(bidders: List[Bidder]) -> List[Tuple[str, str, str]]:
    """
    Builds an entity graph to find hidden cartel rings among bidders.
    Returns a list of colluding pairs: (Bidder 1 Name, Bidder 2 Name, Reason)
    """

    G = nx.Graph()

    # 2. Add every bidder as a "Node" in the graph
    for bidder in bidders:
        G.add_node(bidder.id, name=bidder.legal_name, address=bidder.registered_address, pincode=bidder.pincode)

    # 3. Draw "Edges" (connections) between bidders if they share suspicious attributes
    import itertools
    for b1, b2 in itertools.combinations(bidders, 2):
        reasons = []
        
        # Red Flag A: They share the exact same registered address
        if b1.registered_address and b1.registered_address.lower() == b2.registered_address.lower():
            reasons.append("Shared Registered Address")
            
        # Red Flag B: They were incorporated on the exact same day in the same pincode
        if b1.incorporation_date and b1.incorporation_date == b2.incorporation_date and b1.pincode == b2.pincode:
            reasons.append("Same Incorporation Date and Pincode")
            
        # If they share any red flags, draw a thick connection (edge) between them
        if reasons:
            G.add_edge(b1.id, b2.id, weight=len(reasons), reason=", ".join(reasons))

    # 4. Find the Cartel Rings (Connected Components)
    # A connected component is a cluster of nodes linked together. 
    # If 3 companies are linked, they form a triangle/cluster in the graph.
    cartel_findings = []
    
    for cluster in nx.connected_components(G):
        if len(cluster) > 1: # A cartel needs at least 2 colluding companies
            # Extract the actual names and reasons for the UI
            nodes_list = list(cluster)
            for i in range(len(nodes_list)):
                for j in range(i + 1, len(nodes_list)):
                    if G.has_edge(nodes_list[i], nodes_list[j]):
                        name1 = G.nodes[nodes_list[i]]['name']
                        name2 = G.nodes[nodes_list[j]]['name']
                        reason = G[nodes_list[i]][nodes_list[j]]['reason']
                        cartel_findings.append((name1, name2, reason))

    return cartel_findings
